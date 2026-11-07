import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

// Every named type a public method takes or returns must be importable, or a caller
// cannot annotate the variable that holds the result.
const SDK_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const SRC_DIR = resolve(SDK_DIR, 'src') + sep
const ENTRYPOINTS = ['src/index.ts', 'src/management/index.ts'].map((p) => resolve(SDK_DIR, p))

function unexportedSignatureTypes(): Map<string, string> {
  const program = ts.createProgram([...ENTRYPOINTS, resolve(SDK_DIR, 'src/globals.d.ts')], {
    strict: true,
    noEmit: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    skipLibCheck: true,
  })
  const checker = program.getTypeChecker()
  const resolveAlias = (s: ts.Symbol) => (s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s)
  const inSdk = (d: ts.Declaration) => d.getSourceFile().fileName.startsWith(SRC_DIR)
  const handWritten = (d: ts.Declaration) => inSdk(d) && !d.getSourceFile().fileName.includes('/_generated/')
  const isInternal = (d: ts.Declaration) => ts.getJSDocTags(d).some((tag) => tag.tagName.text === 'internal')

  const exported = new Set<ts.Declaration>()
  const classes: ts.Symbol[] = []
  for (const entry of ENTRYPOINTS) {
    const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(entry)!)!
    for (const e of checker.getExportsOfModule(moduleSymbol)) {
      const target = resolveAlias(e)
      for (const d of target.declarations ?? []) exported.add(d)
      if (target.flags & ts.SymbolFlags.Class) classes.push(target)
    }
  }

  const missing = new Map<string, string>()
  const note = (symbol: ts.Symbol | undefined, via: string) => {
    const decls = symbol?.declarations?.filter(inSdk) ?? []
    if (!decls.length || decls.some((d) => exported.has(d))) return
    const name = symbol!.getName()
    if (symbol!.flags & ts.SymbolFlags.TypeParameter || name.startsWith('__') || missing.has(name)) return
    missing.set(name, via)
  }
  const seenTypes = new Set<ts.Type>()
  const visitType = (t: ts.Type, via: string) => {
    if (t.aliasSymbol) note(t.aliasSymbol, via)
    else if (t.symbol && t.symbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.Class)) note(t.symbol, via)
    if (seenTypes.has(t)) return
    seenTypes.add(t)
    if (t.isUnionOrIntersection()) t.types.forEach((x) => visitType(x, via))
    t.aliasTypeArguments?.forEach((x) => visitType(x, via))
    if (t.flags & ts.TypeFlags.Object && (t as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) {
      checker.getTypeArguments(t as ts.TypeReference).forEach((x) => visitType(x, via))
    }
    // The fields of a hand-written input or result type: a caller builds or reads those too.
    const owner = (t.aliasSymbol ?? t.symbol)?.declarations?.[0]
    if (owner && handWritten(owner) && !(t.symbol?.flags & ts.SymbolFlags.Class)) {
      for (const p of checker.getPropertiesOfType(t)) {
        const decl = p.valueDeclaration ?? p.declarations?.[0]
        if (decl && handWritten(decl)) visitType(checker.getTypeOfSymbolAtLocation(p, decl), `${via}.${p.getName()}`)
      }
    }
  }
  const seenClasses = new Set<ts.Symbol>()
  const visitClass = (classType: ts.Type, path: string) => {
    if (!classType.symbol || seenClasses.has(classType.symbol)) return
    seenClasses.add(classType.symbol)
    for (const member of checker.getPropertiesOfType(classType)) {
      const decl = member.valueDeclaration ?? member.declarations?.[0]
      if (!decl || !inSdk(decl) || isInternal(decl) || member.getName().startsWith('#')) continue
      if (ts.getCombinedModifierFlags(decl) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) continue
      const memberPath = `${path}.${member.getName()}`
      // A name written in the signature: an alias of a generated schema type resolves away in the checker.
      const visitNode = (node: ts.Node): void => {
        if (ts.isTypeReferenceNode(node)) {
          const symbol = checker.getSymbolAtLocation(node.typeName)
          if (symbol) note(resolveAlias(symbol), memberPath)
        }
        ts.forEachChild(node, visitNode)
      }
      for (const d of member.declarations ?? []) ts.forEachChild(d, visitNode)
      const memberType = checker.getTypeOfSymbolAtLocation(member, decl)
      const signatures = memberType.getCallSignatures()
      const related: ts.Type[] = signatures.length ? signatures.map((s) => s.getReturnType()) : [memberType]
      for (const s of signatures) {
        for (const p of s.getParameters()) visitType(checker.getTypeOfSymbolAtLocation(p, decl), `${memberPath}(${p.getName()})`)
      }
      for (const t of related) {
        visitType(t, memberPath)
        if (t.symbol && t.symbol.flags & ts.SymbolFlags.Class) visitClass(t, memberPath)
      }
    }
  }
  for (const c of classes) visitClass(checker.getDeclaredTypeOfSymbol(c), c.getName())
  return missing
}

describe('public signature types', () => {
  it('exports every named type a public method takes or returns', () => {
    const missing = unexportedSignatureTypes()
    expect([...missing].map(([name, via]) => `${name} (${via})`)).toEqual([])
  }, 60_000)
})

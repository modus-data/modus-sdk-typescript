/** Fixture for the public-surface walker's overload/generic-substitution regression tests. */
export class Resource<T> {
  get(): T {
    return undefined as unknown as T
  }
}

export class BoundResource extends Resource<string> {
  find(id: number): string
  find(id: boolean): string
  find(id: number | boolean): string {
    return String(id)
  }
}

export class Modus {
  readonly bound: BoundResource = new BoundResource()
}

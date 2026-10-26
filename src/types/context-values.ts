/** One element of a context item's array field, from `listValues`. */
export type ContextValueRow = {
  /** Position of the element in the array (0-based). */
  readonly index: number
  /** The element itself, as JSON of any type. */
  readonly value: unknown
}

/**
 * Returns a new array containing at most the last `limit` items,
 * with `newItem` appended.
 */
export function appendWithLimit<T>(arr: T[], newItem: T, limit: number): T[] {
  // once arr.length >= limit, drop the oldest (first) item
  return arr.length >= limit ? [...arr.slice(1), newItem] : [...arr, newItem];
}

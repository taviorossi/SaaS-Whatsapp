export function noop(): void {
  // no-op
}

export function identity<T>(x: T): T {
  return x;
}

declare module 'notepack.io' {
  export function encode<T>(value: T): Data
  export function decode<T>(buffer: Data): T
}

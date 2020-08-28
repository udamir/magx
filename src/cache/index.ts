export interface IQuery {
  [key: string]: any
}

export interface ICache<T> {
  set: (key: string, data: T) => Promise<void>
  get: (key: string) => Promise<T | null>
  remove: (key: string) => Promise<void>
  findOne: (query?: IQuery) => Promise<T | null>
  findMany: (query?: IQuery) => Promise<T[]>
}

import { ICache, IQuery } from "."

export const match = (item: any, query: IQuery) => {
  const keys = Object.keys(query)

  for (const key of keys) {

    // if types of values are equal
    if (typeof item[key] !== typeof query[key]) {
      // TODO: check for null
      return false
    }

    // check if value of item[key] is objects
    if (typeof item[key] === "object") {
      // match values of objects
      if (!match(item[key], query[key])) {
        return false
      }
    } else {
      // check values
      if (item[key] !== query[key]) {
        return false
      }
    }
  }
  return true
}

export class LocalCache<T> implements ICache<T> {
  public items: { [key: string]: T }

  constructor() {
    this.items = {}
  }

  public async set(key: string, data: T): Promise<void> {
    return new Promise((resolve) => {
      this.items[key] = data
      resolve()
    })
  }

  public async get(key: string): Promise<T | null> {
    return new Promise((resolve) => {
      resolve(this.items[key] || null)
    })
  }

  public async remove(key: string): Promise<void> {
    return new Promise((resolve) => {
      const index = Object.keys(this.items).indexOf(key)
      if (index < 0) { return }

      delete this.items[key]
      resolve()
    })
  }

  public async findOne(query?: IQuery): Promise<T | null> {
    return new Promise((resolve) => {
      const items = Object.keys(this.items).map((key) => this.items[key])
      resolve(query ? items.find((item) => match(item, query)) || null : items[0])
    })
  }

  public async findMany(query?: IQuery): Promise<T[]> {
    return new Promise((resolve) => {
      const items = Object.keys(this.items).map((key) => this.items[key])
      resolve(query ? items.filter((item) => match(item, query)) : items)
    })
  }
}

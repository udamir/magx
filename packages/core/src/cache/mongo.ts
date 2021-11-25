import type { Collection, Db } from "mongodb"
import { ICache, IQuery } from "."

export class MongoCache<T> implements ICache<T> {
  public cache: Collection

  constructor(db: Db, name: string) {
    this.cache = db.collection(name)
  }

  public async set(key: string, data: T): Promise<void> {
    this.cache.updateOne({ key }, { $set: data }, { upsert: true })
    return
  }

  public async get(k: string): Promise<T | null> {
    const result = await this.cache.findOne({ key: k })
    if (result) {
      const { _id, key, ...data } = result
      return data as T
    } else {
      return null
    }
  }

  public async remove(key: string): Promise<void> {
    await this.cache.deleteOne({ key })
    return
  }

  public async findOne(query?: IQuery): Promise<T | null> {
    const result = await this.cache.findOne(query || {})
    if (result) {
      const { _id, key, ...data } = result
      return data as T
    } else {
      return null
    }
  }

  public async findMany(query?: IQuery): Promise<T[]> {
    const result = await this.cache.find(query || {}).toArray()
    return result.map((item) => {
      const { _id, key, ...rest } = item
      return rest as T
    })
  }
}

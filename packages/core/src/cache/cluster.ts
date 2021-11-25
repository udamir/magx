import { IPCWorker, IPCMaster, IWorkerMessage, LocalCache } from "../internal"
import { ICache, IQuery } from "."

// middleware for IPCMaster with Local cache implementation on master
export const IPCMasterCache = <T>(collection: string) => {
  const cache: ICache<T> = new LocalCache<T>()

  return (ipcm: IPCMaster, message: IWorkerMessage, next: () => void) => {
    const { event, channel, data: messageData } = message
    if (event === "publish" && channel === "ipc-request:master" && messageData.data.collection === collection) {
      const { requestId, method , data } = message.data

      const publishResult = (result: any) => {
        ipcm.onPublish("master", `ipc-response:${requestId}`, { data: result })
      }

      console.log(`Cache ${collection} middlware handle method "${method}" from worker`)
      switch (method) {
        case "set": return cache.set(data.key, data.data).then(publishResult)
        case "get": return cache.get(data.key).then(publishResult)
        case "remove": return cache.remove(data.key).then(publishResult)
        case "findOne": return cache.findOne(data.query).then(publishResult)
        case "findMany": return cache.findMany(data.query).then(publishResult)
      }
    } else {
      next()
    }
  }
}

export class IPCWorkerCache<T> implements ICache<T> {
  public collections: Map<string, ICache<any>> = new Map()

  constructor(public workerIPCM: IPCWorker, public collection: string) {}

  public async set(key: string, data: T): Promise<void> {
    return this.requestMaster<void>("set", { collection: this.collection, key, data })
  }

  public async get(key: string): Promise<T | null> {
    return this.requestMaster<T>("get", { collection: this.collection, key })
  }

  public async remove(key: string): Promise<void> {
    return this.requestMaster<void>("remove", { collection: this.collection, key })
  }

  public async findOne(query?: IQuery): Promise<T | null> {
    return this.requestMaster<T>("findOne", { collection: this.collection, query })
  }

  public async findMany(query?: IQuery): Promise<T[]> {
    return this.requestMaster<T[]>("findMany", { collection: this.collection, query })
  }

  private async requestMaster<S>(method: string, data: any): Promise<S> {
    return this.workerIPCM.requestProcess("master", method, data)
  }
}

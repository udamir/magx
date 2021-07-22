import { IPCManager, ICache, IRoomObject, logger } from "../internal"

export type RoomUpdateSubscriber = (roomId: string, data: IRoomObject | null) => void

const log = logger("room/inspector", 36)

export class RoomInspector {
  public subscribers: { [name: string]: Map<string, RoomUpdateSubscriber> } = {}

  constructor(public ipcm: IPCManager,  public cache: ICache<IRoomObject>) {

    const _set = cache.set.bind(cache)
    cache.set = async (roomId: string, data: IRoomObject): Promise<void> => {
      await _set(roomId, data)
      // publish room_update:{data.name} - roomId
      log.debug(`>> Process ${this.ipcm.processId}: Publish "${roomId}" for channel room_update:${data.name}`)
      ipcm.publish(`room_update:${data.name}`, roomId)
    }

    const _remove = cache.remove.bind(cache)
    cache.remove = async (roomId: string): Promise<void> => {
      const data = await cache.get(roomId)
      await _remove(roomId)

      if (data) {
        // publish roomId -> room_update:{data.name}
        log.debug(`>> Process ${this.ipcm.processId}: Publish "${roomId}" for channel room_update:${data.name}`)
        ipcm.publish(`room_update:${data.name}`, roomId)
      }
    }
  }

  public async onRoomUpdate(name: string, roomId: string) {
    console.log(`>> Process ${this.ipcm.processId}: Room ${name} update: ${roomId}`)
    const data = await this.cache.get(roomId)
    if (this.subscribers[name]) {
      this.subscribers[name].forEach((subscriber) => subscriber(roomId, data))
    }
  }

  public subscribe(id: string, names: string[], subscriber: RoomUpdateSubscriber) {
    names.forEach((name) => {
      if (!this.subscribers[name]) {
        this.subscribers[name] = new Map()
        // subscribe for room_update:{name}
        log.debug(`>> Process ${this.ipcm.processId}: Subscribe for room_update:${name}`)
        this.ipcm.subscribe<string>(`room_update:${name}`, (roomId: string) => this.onRoomUpdate(name, roomId))
      }
      this.subscribers[name].set(id, subscriber)
    })
  }

  public unsubscribe(id: string, names: string[]) {
    names.forEach((name) => {
      this.subscribers[name].delete(id)
      if (!this.subscribers[name].size) {
        delete this.subscribers[name]
        // unsubscribe from room_update:{name}
        log.debug(`>> Process ${this.ipcm.processId}: Unsubscribe from room_update:${name}`)
        this.ipcm.unsubscribe(`room_update:${name}`)
      }
    })
  }
}

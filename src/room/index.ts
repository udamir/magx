import {
  IStateTracker, IJsonPatch, IDisposer,
  Client,
} from "../internal"

const DEFAULT_TICKRATE = 1000 / 20

export interface IRoomData {
  // room name
  name: string

  // port of server
  port?: number

  // host client id
  hostId?: string

  // server process id
  pid?: string | number

  // custom data
  data?: { [key: string]: any }
  [key: string]: any
}

export interface IRoomObject extends IRoomData {
  id: string
  pid: string | number
  clients: string[]
}

interface IClientState {
  trackingParams: { [key: string]: any },
}

export interface ITrackerDisposer {
  trackerDisposer: IDisposer
  patchInterval: NodeJS.Timeout
}

export interface ITrackerParams {
  patchRate?: number
  serializer?: string
  [param: string]: any
}

export type RoomClient = Client<IClientState>

export type RoomClass = new (params: IRoomData) => Room

export abstract class Room<T = any> {
  public state: T = {} as T

  // room id
  public id: string = ""

  // room process id
  public pid: string | number

  // room process ws port
  public port: number | undefined

  // room class name
  public name: string

  // room custom data
  public data: any

  // room host client id
  public hostId: string

  public terminated: boolean = false
  public locked: boolean = false

  // room clients
  public clients: Map<string, RoomClient | null>

  // update cache method
  public updateCache: any = null

  // state change tracker
  public tracker: IStateTracker<T> | null = null
  public disposers: Map<string, ITrackerDisposer>

  constructor(roomData: IRoomData) {
    this.clients = new Map<string, RoomClient | null>()
    this.disposers = new Map<string, ITrackerDisposer>()

    this.id = Date.now().toString(36).substring(3)
    this.hostId = roomData.hostId || ""
    this.pid = roomData.pid || process.pid
    this.port = roomData.port
    this.name = roomData.name
    this.data = {}
  }

  // wait for client reconnection
  public async waitReconnection(client: Client, seconds: number = Infinity): Promise<Client> {
    if (this.terminated) {
      throw new Error(`Room is terminated`)
    }

    return new Promise((resolve, reject) => {
      // check reconnection every second
      const timer = setInterval(() => {
        if (seconds !== Infinity) { seconds-- }
        const newClient = this.clients.get(client.id)
        if (!newClient || seconds <= 0 || this.terminated) {
          clearInterval(timer)
          console.debug("REJECT: reconection error")
          reject()
        } else if (newClient.status === "reconnected") {
          clearInterval(timer)
          newClient.status = "connected"
          resolve(newClient)
        }
      }, 1000)
    })
  }

  public startTracking(client: RoomClient, params: ITrackerParams = {}) {
    // check if client already tracking state
    if (this.disposers.has(client.id)) { return }

    if (!this.tracker) {
      throw new Error("State tracker is not defined!")
    }

    // update client state
    client.state = {
      trackingParams: params,
    }

    const patches = new Map<string, IJsonPatch>()

    // start new tracker
    const trackerDisposer = this.tracker.onPatch((patch: IJsonPatch) => {
      patches.set(patch.op + patch.path, patch)
    }, params)

    const patchInterval = setInterval(() => {
      patches.forEach((patch) => client.patch(patch))
      patches.clear()
    }, params.patchRate || DEFAULT_TICKRATE)

    this.disposers.set(client.id, { trackerDisposer, patchInterval })

    // send state with client
    this.sendState(client, this.tracker.decodeMap(params.serializer))
  }

  public stopTracking(client: RoomClient) {
    // dispose client tracker
    const disposer = this.disposers.get(client.id)
    if (disposer) {
      clearInterval(disposer.patchInterval)
      disposer.trackerDisposer()
    }
    // remove disposer
    this.disposers.delete(client.id)
  }

  public sendState(client: RoomClient, schema?: any) {

    if (!this.tracker) {
      throw new Error("State tracker is not defined!")
    }

    // send snapshot
    const snapshot = this.tracker.snapshot(client.state.trackingParams)
    client.snapshot(snapshot, schema)
  }

  public updateTrackingParams(client: RoomClient, params: ITrackerParams) {

    // stop tracking with old params
    this.stopTracking(client)

    // start tracking with new params
    this.startTracking(client, params)
  }

  // lock room
  public lock() {
    this.locked = true
    this.updateCache && this.updateCache()
  }

  // unlock room
  public unlock() {
    this.locked = false
    this.updateCache && this.updateCache()
  }

  public broadcast(type: string, data: any, exclude?: string) {
    this.clients.forEach((client) => client && client.id !== exclude && client.send(type, data))
  }

  // convert room to cache object
  public toObject(): IRoomObject  {
    return {
      id: this.id,
      pid: this.pid,
      port: this.port,
      hostId: this.hostId,
      name: this.name,
      locked: this.locked,
      clients: [...this.clients.keys()],
      data: this.data,
    }
  }

  // Optional abstract methods
  public createState?(): T
  public createPatchTracker?(state: T): IStateTracker<T>
  public onJoin?(client: RoomClient, params: any): void | Promise<void>
  public onMessage?(client: RoomClient, type: string, data: any): void
  public onLeave?(client: RoomClient, consented?: boolean): void | Promise<void>
  public onCreate?(params: any): void | Promise<void>
  public onClose?(): void | Promise<void>
}

import { send, WSConnection, Room, IRoomData } from "."
import { ISerializer } from "./serializer"

export interface IJsonPatch {
  op: "replace" | "add" | "remove"
  path: string
  value?: any
  oldValue?: any
}

export const ClientEvent = {
  error: 0,
  connected: 1,
  reconnected: 2,
  joined: 3,

  message: 4,
  request: 5,
  response: 6,

  snapshot: 11,
  patch: 12,

  schema: 20,
  encodedSnapshot: -11,
  encodedPatch: -12,
}

export interface IMessagePack {
  encode<T>(value: T): ArrayBuffer
  decode<T>(buffer: ArrayBuffer): T
}

export interface IMessage {
  event: number
  args: any[]
}

export interface IRoomUpdate {
  options?: any
  hostId?: string
  locked?: boolean
}

export interface IConnection {
  readonly protocol: string | string[] | undefined
  readonly url: string
  onClose(handler: (code: number, reason: string) => void): void
  onError(handler: (event: Event) => void): void
  onOpen(handler: (event: Event) => void): void
  onMessage(handler: (message: IMessage) => any): void
  send(message: IMessage): void
}

export interface IAuth {
  id: string
  token: string
  data: any
}

export interface ICTParams {
  url: string
  protocol?: string | string []
  messagePack?: IMessagePack
}

export interface IClientParams {
  port?: number
  address?: string
  secure?: boolean
  id?: string
  token?: string
  data?: any
  serializer?: new () => ISerializer
  transport?: (params: ICTParams) => IConnection
}

export class Client {
  public auth: IAuth | null = null
  public uri = ""
  public address: string
  public port?: number
  public transport: (params: ICTParams) => IConnection
  public serializer?: any
  public secure?: boolean

  constructor(params: IClientParams) {
    this.address = params.address || "localhost"
    this.port = params.port
    this.serializer = params.serializer
    this.secure = params.secure
    this.uri = `${params.secure ? "https" : "http"}://${this.address}${this.port ? ":" + this.port : ""}/magx`
    this.transport = params.transport || ((p) => new WSConnection(p))
  }

  public async verify(token: string): Promise<IAuth | null> {
    try {
      const response = await send.get(this.uri + "/auth/" + token)
      this.auth = response.data || null
      return this.auth
    } catch (error) {
      return null
    }
  }

  public async authenticate(data?: any): Promise<IAuth | null> {
    const response = await send.post(this.uri + "/auth", { body: { data }})
    this.auth = response.data || null
    return this.auth
  }

  public async getRooms(name: string | string[] = []) {
    if (!this.auth) { throw new Error(`Not authenticated`) }

    if(!Array.isArray(name)) { name = [name] }
    const query = name.map((key) => `name=${key}`).join("&")
    const response = await send.get(`${this.uri}/rooms?${query}`, {}, this.auth.token)
    return response.data
  }

  public async reconnect(roomId: string): Promise<Room | null> {
    if (!this.auth) { throw new Error(`Not authenticated`) }

    const response = await send.get(`${this.uri}/rooms/${roomId}`, {}, this.auth.token)
    if (!response.data) {
      return Promise.reject(`Reconnection faild: 404 - Room ${roomId} not found`)
    }
    return this.connectRoom(response.data, true)
  }

  public async createRoom(name: string, options: any = {}): Promise<Room | null> {
    if (!this.auth) { throw new Error(`Not authenticated`) }

    const response = await send.post(`${this.uri}/rooms`, { body: { name, options }}, this.auth.token)
    if (!response.data) {
      return Promise.reject(`Cannot create room: 404 - Room ${name} not found`)
    }
    return this.connectRoom(response.data)
  }

  public async joinRoom(roomId: string, options?: any) {
    if (!this.auth) { throw new Error(`Not authenticated`) }

    const response = await send.post(`${this.uri}/rooms/${roomId}/join`, { body: { options }}, this.auth.token)
    if (!response.data) {
      return Promise.reject(`Cannot join room: 404 - Room ${roomId} not found`)
    }
    return this.connectRoom(response.data)
  }

  public async leaveRoom(roomId: string): Promise<void> {
    if (!this.auth) { throw new Error(`Not authenticated`) }
    await send.post(`${this.uri}/rooms/${roomId}/leave`, {}, this.auth.token)
  }

  public async closeRoom(roomId: string): Promise<void> {
    if (!this.auth) { throw new Error(`Not authenticated`) }
    await send.post(`${this.uri}/rooms/${roomId}/close`, {}, this.auth.token)
  }

  public async updateRoom(roomId: string, update: IRoomUpdate): Promise<Room> {
    if (!this.auth) { throw new Error(`Not authenticated`) }
    const response = await send.post(`${this.uri}/rooms/${roomId}/update`, { body: { update }}, this.auth.token)
    if (!response.data) {
      return Promise.reject(`Cannot update room. Room ${roomId} not found`)
    }
    return this.connectRoom(response.data)
  }

  private connectRoom(data: IRoomData, reconnect = false): Promise<Room> {
    return new Promise((resolve, reject) => {
      const room = new Room(this, data)
      room.onConnected(() => {
        resolve(room)
        room.connection.send({ event: reconnect ? ClientEvent.reconnected : ClientEvent.joined, args: [] })
      })
      room.onError((code, error) => reject(`${code} - ${error}`))
    })
  }
}

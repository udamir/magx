import { EventEmitter } from "events"

import { IAuth, IEncodedJsonPatch } from "../internal"

export type MessageListener = (type: string, data: any) => void
export type EventListener = (...args: any) => void

export interface IClientData {
  roomId: string
  state?: any
}

export const ErrorCode = {
  NormalClose: 1000,
  JoinError: 4000,
  Unathorized: 4001,
  ReservationExpired: 4003,
  RoomNotFound: 4004,
  ConnectionTimeout: 4005,
  ReconnectError: 4002,
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

export type ClientStatus = "connecting" | "connected" | "disconnected" | "reconnected"
export type EventArgs = [ event: number, ...args: any ]

export abstract class Client<T = any> {
  // client session
  public auth: IAuth = {} as IAuth

  // client room id
  public roomId: string

  // client status
  public _status: ClientStatus

  // client state
  public state: T

  // messages stack before connected
  public messages: any[] = []

  // client id and data
  get id(): string { return this.auth.id }
  get data(): any { return this.auth.data }
  get status(): ClientStatus {
    return this._status
  }
  set status(status: ClientStatus) {
    this._status = status
    if (status === "connected" || status === "reconnected") {
      this.messages.forEach((args: EventArgs) => this.emit(...args))
      this.messages = []
    }
  }

  constructor(data: IClientData) {
    this.roomId = data.roomId
    this._status = "connecting"
    this.state = data.state || {} as T
  }

  private safeEmit(event: number, ...args: any) {
    if (this.status === "connecting") {
      this.messages.push([ event, ...args ])
    } else {
      this.emit(event, ...args)
    }
  }

  // send message
  public send(type: string, data: any) {
    this.safeEmit(ClientEvent.message, type, data)
  }

  // add message listner
  public onMessage(listner: MessageListener) {
    this.on(ClientEvent.message, listner)
  }

  // send state patch
  public patch(patch: IEncodedJsonPatch) {
    if (patch.encoded) {
      this.safeEmit(ClientEvent.encodedPatch, patch.encoded)
    } else {
      const { encoded, ...rest } = patch
      this.safeEmit(ClientEvent.patch, rest)
    }
  }

  // send state snapshot
  public snapshot(snapshot: any) {
    this.safeEmit(ClientEvent.snapshot, snapshot)
  }

  public error(code?: number, message?: string) {
    this.emit(ClientEvent.error, code, message)
    this.terminate(code, message)
  }

  public connected() {
    this.emit(ClientEvent.connected)
  }

  public async request(type: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.safeEmit(ClientEvent.request, type, data, (err: any, res: any) => {
        if (err) {
          console.debug("REJECT: request error")
          reject(err)
        } else {
          resolve(res)
        }
      })
    })
  }

  public abstract on(event: number, listner: MessageListener): void
  public abstract emit(event: number, ...args: any): void

  public abstract terminate(code?: number, reason?: string): void
}

export abstract class Transport<T extends Client = any> extends EventEmitter {
  public onConnect(client: T, token: string) {
    this.emit("connect", client, token)
  }

  public onDisconnect(client: T, code: number) {
    this.emit("disconnect", client, code)
  }

  abstract get port(): number | undefined

  public abstract terminate(): void
}

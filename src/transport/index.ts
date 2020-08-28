import { EventEmitter } from "events"

import { IAuth, IJsonPatch } from "../internal"

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
  message: "_message",
  request: "_request",
  snapshot: "_snapshot",
  patch: "_patch",
  error: "_error",
  connected: "_connected",
}

export abstract class Client<T = any> {
  // client session
  public auth: IAuth = {} as IAuth

  // client room id
  public roomId: string

  // client status
  public status: "connecting" | "connected" | "disconnected" | "reconnected"

  // client state
  public state: T

  // client id and data
  get id(): string { return this.auth.id }
  get data(): any { return this.auth.data }

  constructor(data: IClientData) {
    this.roomId = data.roomId
    this.status = "connecting"
    this.state = data.state || {} as T
  }

  // send message
  public send(type: string, data: any) {
    this.emit(ClientEvent.message, type, data)
  }

  // add message listner
  public onMessage(listner: MessageListener) {
    this.on(ClientEvent.message, listner)
  }

  // send state patch
  public patch(id: number, patch: IJsonPatch) {
    this.emit(ClientEvent.patch, id, patch)
  }

  // send state snapshot
  public snapshot(id: number, snapshot: any) {
    this.emit(ClientEvent.snapshot, id, snapshot)
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
      this.emit(ClientEvent.request, type, data, (err: any, res: any) => {
        if (err) {
          console.debug("REJECT: request error")
          reject(err)
        } else {
          resolve(res)
        }
      })
    })
  }

  public abstract on(event: string, listner: MessageListener): void
  public abstract emit(event: string, ...args: any): void

  public abstract terminate(code?: number, reason?: string): void
}

export abstract class Transport<T extends Client = any> extends EventEmitter {
  public onConnect(client: T, token: string) {
    this.emit("connect", client, token)
  }

  public onDisconnect(client: T) {
    this.emit("disconnect", client)
  }

  abstract get port(): number | undefined

  public abstract terminate(): void
}

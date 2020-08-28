import { Socket } from "socket.io"

import { IClientData, Client } from "../../internal"

export interface ISocketIOClientData extends IClientData {
  ref: Socket
}

export class SocketIOClient extends Client {
  public socket: Socket

  constructor(data: ISocketIOClientData) {
    super(data)
    this.socket = data.ref
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    this.socket.on(event, listener)
    return this
  }

  public emit(event: string, ...args: any[]): boolean {
    return this.socket.emit(event, ...args)
  }

  public terminate(code: number, reason: string) {
    // TODO: terminate conection, notify client
    // this.socket.error({ code, reason })
    this.socket.disconnect()
  }
}

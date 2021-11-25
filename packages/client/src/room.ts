import { Client, IJsonPatch, IConnection, IMessage, IRoomUpdate, ClientEvent } from "."
import { ISerializer } from "./serializer"

interface IChangeHandler {
  op: string
  filter: any[]
  handler: (patch: IJsonPatch, params: any) => void
}

export interface IRoomData {
  id: string
  port: number
  name: string
  options?: any
}

export class Room {
  public id: string
  public port?: number
  public connection: IConnection
  public name: string
  public patchIndex: number = 0
  public options: any
  public serializer?: ISerializer

  public handlers: { [event: string]: any } = {}

  constructor(public client: Client, roomData: IRoomData) {
    this.id = roomData.id
    this.port = roomData.port || this.client.port
    this.name = roomData.name
    this.options = roomData.options || {}
    this.serializer = client.serializer ? new client.serializer() : undefined

    this.handlers = {
      _message: {},
      _request: {},
      _change: [],
    }

    if (!this.client.auth) {
      throw new Error(`Cannot create room - not authorized client`)
    }

    const url = `${this.client.secure ? 'wss' : 'ws'}://${this.client.address}${this.port ? ":" + this.port : ""}/${this.id}?${this.client.auth.token}`
    this.connection = this.client.transport({ url })

    this.connection.onMessage((msg: IMessage) => {

      const onMessage: any = (type: string, data: any): void => {
        this.handlers._message[type] && this.handlers._message[type](data)
      }

      const onRequest: any = (type: string, data: any, reqId: string) => {
        this.handlers._request[type] && this.handlers._request[type](data).then((result: any) => {
          this.connection && this.connection.send({ event: ClientEvent.response, args: [reqId, result]})
        })
      }

      const onSnapshot: any = (snapshot: any) => {
        if (this.serializer) {
          snapshot = this.serializer.decodeState(snapshot)
        }
        this.handlers._snapshot && this.handlers._snapshot(snapshot)
      }

      const onPatch: any = (patch: IJsonPatch) => {
        this.handlers._patch && this.handlers._patch(patch)

        const handlers: IChangeHandler[] = this.handlers._change || []
        const match = handlers.find((handler) => {
          if (handler.op !== "*" && handler.op !== patch.op) {
            return false
          }
          let path = handler.filter.map((item) => item.type === "param" ? "[a-zA-Z0-9_.-]+" : item.name).join("\/")
          path = path.slice(-1) === "*" ? path.slice(0, -1) : (path + "$")
          return new RegExp(path).test(patch.path)
        })

        if (match) {
          const pathArr = patch.path.replace(/^\/+|\/+$/g, "").split("/")
          const params: { [name: string]: string | number} = {}
          match.filter.forEach((item) => {
            if (item.type === "param") {
              params[item.name] = +pathArr[item.index] || pathArr[item.index]
            }
          })
          match.handler(patch, params)
        }
      }

      const onEncodedPatch: any = (buffer: any) => {
        try {
          if (this.serializer) {
            const patch = this.serializer.decodePatch(buffer)
            onPatch(patch)
          }
        } catch (error) {
          throw new Error(error)
        }
      }

      const onConnected: any = () => {
        this.handlers._connected && this.handlers._connected()
      }

      const onError: any = (code: number, error: string) => {
        this.handlers._error && this.handlers._error(code, error)
      }

      switch (msg.event) {
        case ClientEvent.connected: return onConnected()
        case ClientEvent.snapshot: return onSnapshot(...msg.args)
        case ClientEvent.message: return onMessage(...msg.args)
        case ClientEvent.request: return onRequest(...msg.args)
        case ClientEvent.patch: return onPatch(...msg.args)
        case ClientEvent.encodedPatch: return onEncodedPatch(...msg.args)
        case ClientEvent.error: return onError(...msg.args)
      }
    })
  }

  public onConnected(handler: () => void) {
    this.handlers._connected = handler
  }

  public onPatch(handler: (patch: IJsonPatch) => void) {
    this.handlers._patch = handler
  }

  public onSnapshot(handler: (snapshot: any) => void) {
    this.handlers._snapshot = handler
  }

  public onChange(op: string, path: string, handler: (patch: IJsonPatch, params: any) => void) {
    const filter = path.replace(/^\/+|\/+$/g, "").split("/").map((item, index) => {
      if (item[0] === ":") {
        return { type: "param", name: item.slice(1), index }
      } else if (item === "*") {
        return { type: "any", index }
      } else {
        return { type: "const", name: item, index }
      }
    })

    this.handlers._change.push({ op, filter, handler })
  }

  public onAdd(path: string, handler: (patch: IJsonPatch, params: any) => void) {
    this.onChange("add", path, handler)
  }

  public onReplace(path: string, handler: (patch: IJsonPatch, params: any) => void) {
    this.onChange("replace", path, handler)
  }

  public onRemove(path: string, handler: (patch: IJsonPatch, params: any) => void) {
    this.onChange("remove", path, handler)
  }

  public onRequest(type: string, handler: (data: any) => Promise<any>) {
    this.handlers._request[type] = handler
  }

  public onMessage(type: string, handler: (data: any) => void) {
    this.handlers._message[type] = handler
  }

  public send(type: string, data?: any) {
    this.connection && this.connection.send({ event: ClientEvent.message, args: [ type, data ] })
  }

  public onLeave(handler: () => void) {
    this.connection.onClose(handler)
  }

  public onError(handler: (code: number, error: any) => void) {
    this.handlers._error = handler
  }

  public leave() {
    return this.client.leaveRoom(this.id)
  }

  public close() {
    return this.client.closeRoom(this.id)
  }

  public update(update: IRoomUpdate) {
    return this.client.updateRoom(this.id, update)
  }
}

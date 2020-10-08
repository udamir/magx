import { Client, ClientEvent, IJsonPatch, MessageListener, Room } from "../internal"
import * as notepack from "notepack.io"

interface IChangeHandler {
  op: string
  filter: any[]
  handler: (patch: IJsonPatch, params: any) => void
}

export abstract class LocalClient extends Client {
  public handlers: { [event: string]: any } = {}
  public listeners: { [event: string]: MessageListener[] } = {}

  constructor(public room: Room, auth: any = {}) {
    super({ roomId: room.id })
    this.auth = auth
    this.status = "connected"

    this.handlers = {
      _message: {},
      _request: {},
      _change: [],
    }
  }

  public send(type: string, data: any) {
    if (!this.room.onMessage) { return }
    this.room.onMessage(this, type, data)
  }

  public on(event: number, listner: MessageListener) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(listner)
  }

  public emit(event: number, ...args: any) {

    const onMessage: any = (type: string, data: any): void => {
      this.handlers._message[type] && this.handlers._message[type](data)
    }

    const onSnapshot: any = (snapshot: any) => {
      this.handlers._snapshot && this.handlers._snapshot(snapshot)
    }

    const onPatch: any = (patch: any) => {
      this.handlers._patch && this.handlers._patch(patch)

      const handlers: IChangeHandler[] = this.handlers._change || []
      const match = handlers.find((handler) => {
        if (handler.op !== "*" && handler.op !== patch.op) {
          return false
        }
        let path = handler.filter.map((item) => item.type === "param" ? "[a-zA-Z0-9_.]+" : item.name).join("\/")
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
      onPatch(notepack.decode(buffer))
    }

    switch (event) {
      case ClientEvent.snapshot: return onSnapshot(...args)
      case ClientEvent.message: return onMessage(...args)
      case ClientEvent.patch: return onPatch(...args)
      case ClientEvent.encodedPatch: return onEncodedPatch(...args)
    }
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

  public join(params: any) {
    if (this.room.locked) { return }
    const id = Math.random().toString(32).slice(3)

    this.room.clients.set(id, this)

    this.room.updateTrackingParams(this, params)

    this.room.updateCache()
  }

  public terminate(code?: number, reason?: string) {
    if (this.room.onLeave) {
      this.room.onLeave(this, true)
    }

    // stop tracking and remove client
    this.room.stopTracking(this)
    this.room.clients.delete(this.id)

    // update room cache
    this.room.updateCache()
  }
}

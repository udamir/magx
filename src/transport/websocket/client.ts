import WebSocket from "ws"

import { Client, IClientData, EventListener, IMessagePack, ClientEvent } from "../../internal"

export interface IWebSocketClientData extends IClientData {
  ref: WebSocket
  messagePack: IMessagePack
  requestTimeout?: number
}

interface IResponse {
  resolve: any
  reject: any
  timer: NodeJS.Timer
}

export class WebSocketClient extends Client {
  // websocket
  public ws: WebSocket

  // message serializer
  public messagePack: IMessagePack

  // ping tries count
  public pingCount: number = 0

  // event listeners
  public listners: { [type: number]: EventListener[] } = {}

  // request timeout
  public requestTimeout: number

  // requests index
  public lastResponseId: number = 0

  // request resposes handlers
  public responses: { [id: number]: IResponse } = {}

  constructor(clientData: IWebSocketClientData) {
    super(clientData)
    this.ws = clientData.ref
    this.messagePack = clientData.messagePack
    this.requestTimeout = clientData.requestTimeout || 1000

    this.ws.on("message", (buf: Buffer) => {
      const event = buf[0]
      const args = this.messagePack.decode<any[]>(buf.slice(1))

      if (event === ClientEvent.response) {
        // handlet request response
        const [ id, err, data ] = args
        const response = this.responses[id]
        if (response) {
          clearTimeout(response.timer)
          if (err) {
            console.debug("REJECT: response error")
            response.reject(err)
          } else {
            response.resolve(data)
          }
        }
      } else if (event) {
        // handle event listeners
        const listners = this.listners[event] || []
        listners.forEach(((listener) => listener(...args)))
      }
    })
  }

  // make request and get response
  public async request(type: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.lastResponseId++
      const timer = setTimeout(() => reject("Request timeout"), 1000)
      this.responses[id] = { resolve, reject, timer }
      this.emit(ClientEvent.request, type, data, id)
    })
  }

  // add event listner
  public on(event: number, listner: EventListener) {
    if (!this.listners[event]) {
      this.listners[event] = []
    }
    this.listners[event].push(listner)
  }

  // send event
  public emit(event: number, ...args: any[]): void {
    // transport protocol:
    //        | event | messagePack args
    // Buffer |    01 | 34 FF AD ...

    const pack = this.messagePack.encode(args)
    this.ws.send(Buffer.concat([Buffer.from([event]), pack]))
  }

  // terminate connection
  public terminate(code: number, reason: string) {
    this.ws.close(code, reason)
  }
}

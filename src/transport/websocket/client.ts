import WebSocket from "ws"

import { Client, IClientData, EventListener, IMessagePack } from "../../internal"

export interface IWebSocketClientData extends IClientData {
  ref: WebSocket
  messagePack: IMessagePack
  requestTimeout?: number
}

interface IMessage {
  event: string
  args: any
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
  public listners: { [type: string]: EventListener[] } = {}

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

    this.ws.on("message", (msg) => {
      const message = this.messagePack.decode<IMessage>(msg)
      // console.log(`Message from server`, message)
      if (message.event === "_response") {
        // handlet request response
        const [ id, err, data ] = message.args
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
      } else if (message.event) {
        // handle event listeners
        const listners = this.listners[message.event] || []
        listners.forEach(((listener) => listener(...message.args)))
      }
    })
  }

  // make request and get response
  public async request(type: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.lastResponseId++
      const timer = setTimeout(() => reject("Request timeout"), 1000)
      this.responses[id] = { resolve, reject, timer }
      this.emit("_request", type, data, id)
    })
  }

  // add event listner
  public on(event: string, listner: EventListener) {
    if (!this.listners[event]) {
      this.listners[event] = []
    }
    this.listners[event].push(listner)
  }

  // send event
  public emit(event: string, ...args: any): void {
    // console.log(`Send message to client`, event, JSON.stringify(args))
    this.ws.send(this.messagePack.encode<IMessage>({ event, args }))
  }

  // terminate connection
  public terminate(code: number, reason: string) {
    this.ws.close(code, reason)
  }
}

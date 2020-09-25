import * as notepack from "notepack.io"
import * as http from "http"
import * as https from "https"
import WebSocket from "ws"
import url from "url"

import { Transport, WebSocketClient, IWebSocketClientData } from "../../internal"

const noop = () => {/* tslint:disable:no-empty */ }

export interface IMessagePack {
  encode<T>(value: T): Buffer
  decode<T>(buffer: Buffer): T
}

export interface IWebSocketTransportOptions {
  // websocket server port
  // default: 8000
  port?: number

  // http server
  server?: http.Server | https.Server

  // ping interval for connectivity check
  // default: 1500
  pingInterval?: number

  // max ping retries before disconnect
  // default: 2
  maxPingRetries?: number

  // client request timeout
  // default: 1000
  clientRequestTimeout?: number

  // message serializer
  // default: notepack
  messagePack?: IMessagePack
}

export class WebSocketTransport extends Transport<WebSocketClient> {
  public clients: Set<WebSocketClient> = new Set<WebSocketClient>()
  public wss: WebSocket.Server
  public pingTimeout: NodeJS.Timeout | undefined
  public clientRequestTimeout: number
  public messagePack: IMessagePack

  public get port() {
    return this.wss && this.wss.options.port
  }

  constructor(options: IWebSocketTransportOptions) {
    super()

    // create websocket server
    this.wss = new WebSocket.Server({ port: options.port, server: options.server })

    this.messagePack = options.messagePack || notepack

    this.clientRequestTimeout = options.clientRequestTimeout || 1000

    // check clients for connection
    const pingInterval = options.pingInterval || 1500
    const maxPingRetries = options.maxPingRetries || 2
    if (pingInterval > 0 && maxPingRetries > 0) {
      this.pingTimeout = this.pingClients(pingInterval, maxPingRetries)
    }

    // handle connection of client
    this.wss.on("connection", this.onConnection.bind(this))
    this.wss.on("close", this.onClose.bind(this))
  }

  public pingClients(pingInterval: number, maxPingRetries: number) {
    return setInterval(() => {
      this.clients.forEach((client) => {

        if (client.pingCount >= maxPingRetries) {
          console.debug("Client terminated - not responding")
          this.pingTimeout && clearInterval(this.pingTimeout)
          return client.ws.terminate()
        }

        client.pingCount++
        client.ws.ping(noop)
      })
    }, pingInterval)
  }

  public onConnection(socket: WebSocket, request: http.IncomingMessage) {

    const parsedURL = request.url && url.parse(request.url) || {} as any
    const query = parsedURL.query || ""
    const data: IWebSocketClientData = {
      roomId: parsedURL.pathname.slice(1),
      ref: socket,
      requestTimeout: this.clientRequestTimeout,
      messagePack: this.messagePack,
    }

    const client = new WebSocketClient(data)

    this.clients.add(client)
    this.onConnect(client, query)

    socket.on("pong", () => client.pingCount = 0)

    socket.on("close", (code: number, respon: string) => {
      // TODO: check code
      this.clients.delete(client)
      this.onDisconnect(client, code)
    })
  }

  public onClose() {
    this.pingTimeout && clearInterval(this.pingTimeout)
  }

  public terminate() {
    this.wss.close()
  }
}

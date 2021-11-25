import { PatchPack } from "patchpack"

import { IMessagePack, IConnection, ICTParams, IMessage } from "."

export class WSConnection implements IConnection {
  public ws: WebSocket
  public messagePack: IMessagePack

  public readonly protocol: string | string[] | undefined
  public readonly url: string

  constructor(params: ICTParams) {
    this.url = params.url
    this.protocol = params.protocol
    this.ws = new WebSocket(params.url, params.protocol)
    this.messagePack = params.messagePack || PatchPack
  }

  public onClose(handler: (code: number, reason: string) => void) {
    this.ws.onclose = (event: CloseEvent) => handler(event.code, event.reason)
  }

  public onError(handler: (event: Event) => void) {
    this.ws.onerror = (e) => handler(e)
  }

  public onOpen(handler: (event: Event) => void) {
    this.ws.onopen = (e) => handler(e)
  }

  public onMessage(handler: (message: IMessage) => any) {
    this.ws.onmessage = (msg: MessageEvent) => {
      const processMessage = (bufArray: ArrayBuffer) => {
        const buffer = new Int8Array(bufArray)
        const event = buffer[0]
        const data = buffer.slice(1)
        const args = event < 0 ? [data] : this.messagePack.decode<any[]>(data)
        handler({ event, args })
      }

      if (msg.data.arrayBuffer) {
        // event data - Buffer
        msg.data.arrayBuffer().then((buffer: Buffer) => {
          processMessage(buffer)
        })
      } else {
        // event data - BufferArray
        processMessage(msg.data)
      }
    }
  }

  public send(message: IMessage): void {
    const data = this.messagePack.encode(message.args)
    const dataBuffer = new Uint8Array(data)
    const bufArray = new ArrayBuffer(data.byteLength + 1)
    const buffer = new Uint8Array(bufArray)
    buffer[0] = message.event
    buffer.set(dataBuffer, 1)
    this.ws.send(bufArray)
  }

  public close() {
    this.ws.close()
  }
}

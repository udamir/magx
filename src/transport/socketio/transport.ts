import { Server, Socket } from "socket.io"

import { Transport } from "../../internal"
import { SocketIOClient, ISocketIOClientData } from "."

export class SocketIOTransport extends Transport<SocketIOClient> {
  public io: Server

  constructor(params: any) {
    super()
    this.io = params.io

    this.io.of(/^\/room-\w+$/).on("connect", (socket: Socket) => {

      const data: ISocketIOClientData = {
        roomId: socket.nsp.name.slice(5),
        ref: socket,
      }

      const client = new SocketIOClient(data)
      this.onConnect(client, socket.handshake.query.token)

      // emit connection to all servers in cluster
      socket.on("disconected", () => {
        this.onDisconnect(client)
      })
    })
  }

  get port(): number {
    this.io.engine
    return 0 // TODO
  }

  public terminate() {
    this.io.close()
  }
}

import { Server, Client, ErrorCode, Router, Room, IRequestContext, ClientEvent } from "magx"

export const monitor = (server: Server, params: any = {}) => {

  const authData = params?.secret || "monitor"
  const serializer = params?.serializer 

  // attach frontend js
  server.router.get("/magx/monitor/js", async (ctx: IRequestContext) => {
    ctx.type = "javascript"
    ctx.attachment = "index.js"
    ctx.buffer = `
      const serializer = ${ serializer === "schema" ? "MagX.SchemaSerializer" : '""' }
      const authData = "${authData}"
    `
  })
  // attach frontend
  server.router.get("/magx/monitor/", Router.send(__dirname, "/../public/rooms.html"))
  server.router.get("/magx/monitor/:roomId", Router.send(__dirname, "/../public/room.html"))

  let monitorClient: Client | null = null

  const _onClientConnected = server.rooms.onClientConnected.bind(server.rooms)
  const _onClientDisconnected = server.rooms.onClientDisconnected.bind(server.rooms)

  const manager = server.rooms

  manager.onClientConnected = async (client: Client) => {
    if (client.auth.data === authData) {
      monitorClient = client
      // find client's room
      const room = manager.rooms.get(client.roomId)
      if (!room) {
        return client.error(ErrorCode.RoomNotFound, "Room not found")
      }

      client.on(ClientEvent.joined, async () => {

        client.onMessage((type: string, data: any) => {
          switch (type) {
            case "client_message": return clientMessage(room, data)
            case "terminate_client": return terminateClient(room, data)
          }
        })

        room.clients.forEach((roomClient: Client<any> | null, id: string) => {
          if (!roomClient) { return }

          client.send("client_connected", {
            id,
            auth: roomClient.auth,
            trackingParams: roomClient.state.trackingParams,
          })
        })

        // start track state changes for client
        if (room.tracker) {
          room.startTracking(client, { spy: true })
        }

        client.status = "connected"
      })

      client.connected()

    } else {
      await _onClientConnected(client)
      if (monitorClient && client.status === "connected") {
        monitorClient.send("client_connected", {
          id: client.id,
          auth: client.auth,
          trackingParams: client.state.trackingParams,
        })
      }
    }
  }
  manager.onClientDisconnected = async (client: Client, code: number) => {
    if (client.auth.data === authData) {
      // find client's room
      const room = manager.rooms.get(client.roomId)
      if (!room) {
        return client.error(ErrorCode.RoomNotFound, "Room not found")
      }
      room.stopTracking(client)
    } else {
      await _onClientDisconnected(client, code)
      if (monitorClient && client.status === "disconnected") {
        monitorClient.send("client_disconnected", { id: client.id })
      }
    }
  }
}

const clientMessage = (room: Room<any>, { clientId, type, data }: any) => {
  const client = room.clients.get(clientId)
  if (!client) { return }
  room.onMessage && room.onMessage(client, type, data)
}

const terminateClient = (room: Room<any>, clientId: string) => {
  const client = room.clients.get(clientId)
  if (!client) { return }
  client.terminate()
}

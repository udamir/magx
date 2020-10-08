import {
  Server, Client, ErrorCode, ClientEvent,
  Room, RoomClass, IRoomObject,
  RoomInspector, LobbyRoom,
  ICache,
} from "./internal"

export interface ISyncRoomTypes {
  [name: string]: {
    roomClass: RoomClass,
    params: any,
  }
}

export interface ICreateRoomData {
  sessionId: string
  name: string
  options?: any
}

export interface IJoinRoomData {
  sessionId: string
  roomId: string
  options?: any
}

export interface IRoomUpdate {
  data?: any
  hostId?: string
  locked?: boolean
}

export interface IUpdateRoomData {
  sessionId: string
  roomId: string
  update: IRoomUpdate
}

export interface ILeaveRoomData {
  sessionId: string
  roomId: string
}

export interface ICloseRoomData {
  sessionId: string
  roomId: string
}

export class RoomManager {
  // registered rooms
  public roomTypes: ISyncRoomTypes = {}

  // rooms storage
  public rooms: Map<string, Room<any>>

  // inspector for rooms update
  public inspector: RoomInspector

  // researved seats
  public reservedSeats: Map<string, any>
  public reservationTimeout: number = 3

  constructor(
    // server reference
    public server: Server,
    // cache for rooms
    public cache: ICache<IRoomObject>,
  ) {
    this.inspector = new RoomInspector(server.ipcm, cache)
    this.rooms = new Map<string, Room<any>>()
    this.reservedSeats = new Map<string, any>()
  }

  public defineRoomType(name: string, roomClass: RoomClass, params?: any) {
    this.roomTypes[name] = { roomClass, params }
  }

  public setRoomClient(room: Room, client: Client, trackingParams?: any) {
    // redirect all client messages to room
    client.onMessage((type: string, data: any) => room.onMessage && room.onMessage(client, type, data))

    // update room client
    room.clients.set(client.id, client)

    // start track state changes for client with previous trackingParams
    if (room.tracker) {
      room.startTracking(client, trackingParams)
    }
  }

  public async removeRoomClient(room: Room, client: Client) {
    // remove client
    room.clients.delete(client.id)

    if (!room.clients.size) {
      // remove room without clients
      return this.removeRoom(room)
    } else {
      // update room cache
      return this.cache.set(room.id, room.toObject())
    }
  }

  // handle client connection
  public async onClientConnected(client: Client) {
    console.debug(`>> Process ${this.server.processId}: Client ${client.id} connect to room`, client.roomId)

    // find client's room
    const room = this.rooms.get(client.roomId)
    if (!room) {
      return client.error(ErrorCode.RoomNotFound, "Room not found")
    }

    const roomClient = room.clients.get(client.id)
    // check if client reconnected
    if (roomClient) {
      if (roomClient.status !== "disconnected") {
        // terminate previos previos client
        roomClient.error(ErrorCode.ReconnectError, "Client Reconnected")
      }

      client.on(ClientEvent.reconnected, async () => {
        clearTimeout(timer)

        this.setRoomClient(room, client, roomClient.state.trackingParams)

        client.status = "reconnected"
      })
    } else {
      // check reserved seat
      const reservationId = client.roomId + "-" + client.id
      if (!this.reservedSeats.has(reservationId)) {
        // terminate client
        return client.error(ErrorCode.ReservationExpired, "Reservation expired")
      }

      const { options, disposer } = this.reservedSeats.get(reservationId)
      // dispose resevation timout
      clearTimeout(disposer)
      // remove reservation
      this.reservedSeats.delete(reservationId)

      client.on(ClientEvent.joined, async () => {
        clearTimeout(timer)

        // trigger room.onJoin(client)
        try {
          room.onJoin && await room.onJoin(client, options)
        } catch (error) {
          return client.error(ErrorCode.JoinError, error.message)
        }

        this.setRoomClient(room, client)

        client.status = "connected"
      })
    }

    const timer = setTimeout(() => {
      client.error(ErrorCode.ConnectionTimeout, "Connection timeout")
    }, this.server.connectionTimeout)

    // set clent connected
    client.connected()
  }

  // handle client disconnection
  public async onClientDisconnected(client: Client, code: number) {
    console.debug(`>> Process ${this.server.processId}: Client ${client.id} disconnect from room`, client.roomId)

    // set status to dsconnected
    client.status = "disconnected"

    // find client's room
    const room = this.rooms.get(client.roomId)
    if (!room) {
      return client.error(ErrorCode.RoomNotFound, "Room not found")
    }

    // stop tracking
    room.stopTracking(client)

    // check if client in room
    if (room.clients.get(client.id)) {
      // trigger room.onLeave(client)
      room.onLeave && await room.onLeave(client, code === 1000)
      // check if client status updated
      const roomClient = room.clients.get(client.id)
      if (roomClient && roomClient.status === "connected") {
        // reconnected
        return
      }
    }

    return this.removeRoomClient(room, client)
  }

  // reserve seat for client
  public async reserveSeat(roomId: string, sessionId: string, options: any) {
    console.debug(`>> Process ${this.server.processId} requested: Reserve seat for client ${sessionId} in room`, roomId)
    // get room
    const room = this.rooms.get(roomId)
    if (!room) {
      throw new Error(`Room with id ${roomId} not found`)
    }

    // check if client already joined room
    if (room.clients.has(sessionId)) {
      throw new Error(`Client with id ${sessionId} already in room`)
    }

    // add client reservation to room
    room.clients.set(sessionId, null)

    const disposer = setTimeout(() => {
      // delete reservation on timeout
      this.reservedSeats.delete(roomId + "-" + sessionId)
      room.clients.delete(sessionId)

      if (!room.clients.size) {
        this.removeRoom(room)
      } else {
        // update room cache
        this.cache.set(roomId, room.toObject())
      }

    }, this.reservationTimeout * 1000)

    // save reservation
    this.reservedSeats.set(roomId + "-" + sessionId, { options, disposer })

    console.debug(`>> Process ${this.server.processId} requested: Save room ${roomId} to cache`)
    // update room cache
    await this.cache.set(roomId, room.toObject())
  }

  // get room
  public async getRoomObject(roomId: string = ""): Promise<IRoomObject | null> {
    console.debug(`>> Process ${this.server.processId}: Get room ${roomId}`)
    return this.cache.get(roomId)
  }

  // get avaliable rooms
  public async getAvaliableRooms(name: string | string[] = []): Promise<IRoomObject[]> {
    console.debug(`>> Process ${this.server.processId}: Get avalible rooms ${name}`)
    if (!Array.isArray(name)) { name = [name] }
    const rooms = await this.cache.findMany()
    return name.length ? rooms.filter((room) => name.indexOf(room.name) >= 0) : rooms
  }

  // create room
  public async createRoom({ sessionId, name, options }: ICreateRoomData, join = true): Promise<IRoomObject> {
    console.debug(`>> Process ${this.server.processId} requested: Create room ${name}`)

    if (!Object.keys(this.roomTypes).includes(name)) {
      throw new Error(`Room with name ${name} not found`)
    }

    // create room
    const { roomClass, params } = this.roomTypes[name]
    const room = new roomClass({
      pid: this.server.processId,
      port: this.server.transport.port,
      hostId: sessionId,
      name,
    })

    console.debug(`>> Process ${this.server.processId}: Created room ${name} with id ${room.id}`)

    // update room cache on update
    room.updateCache = () => {
      if (!room.clients.size) {
        this.removeRoom(room)
      } else {
        this.cache.set(room.id, room.toObject())
      }
    }

    // call room on create
    room.onCreate && await room.onCreate({ ...params, options })

    // create state
    if (room.createState) {
      room.state = room.createState()
    }

    // create patch tracker
    if (room.createPatchTracker) {
      room.tracker = room.createPatchTracker(room.state)
    }

    // save created room
    this.rooms.set(room.id, room)

    // hack for lobby room
    if (room instanceof LobbyRoom) {
      room.getRooms = (names: string[]) => this.server.getRooms(names)
      this.inspector.subscribe(room.id, room.watch, (roomId, data) => room.onRoomUpdate(roomId, data))
    }

    if (join) {
      // join room
      return this.joinRoom({ sessionId, roomId: room.id, options })
    }

    // save room to cache
    await this.cache.set(room.id, room.toObject())
    return room.toObject()
  }

  // join room
  public async joinRoom({ sessionId, roomId, options }: IJoinRoomData): Promise<IRoomObject> {
    console.debug(`Process ${this.server.processId} requested: Join room ${roomId} for client ${sessionId}`)
    // get room
    const room = this.rooms.get(roomId)

    if (!room) {
      throw new Error(`Cannot join the room with id ${roomId} - room not found`)
    }

    if (room.locked) {
      throw new Error(`Cannot join the room with id ${roomId} - room is locked`)
    }

    const client = room.clients.get(sessionId)
    if (!client) {
      // reserve seat for client
      this.reserveSeat(roomId, sessionId, options)
    } else if (client && client.status !== "disconnected") {
      // client already in room
      throw new Error(`Client ${sessionId} already in room`)
    }

    // send response
    return room.toObject()
  }

  public async updateRoom({ sessionId, roomId, update }: IUpdateRoomData): Promise<IRoomObject> {
    // get room
    const room = this.rooms.get(roomId)

    if (!room) {
      throw new Error(`Room with id ${roomId} not found`)
    }

    if (room.hostId && room.hostId !== sessionId) {
      throw new Error(`Only host can update Room with id ${roomId}`)
    }

    // reserve seat for session
    room.data = update.data || room.data
    room.locked = update.locked || room.locked
    room.hostId = update.hostId || room.hostId

    // updated room's cache
    await this.cache.set(room.id, room.toObject())

    // send response
    return room.toObject()
  }

  // leave room
  public async leaveRoom({ sessionId, roomId }: ILeaveRoomData): Promise<void> {

    // get client's room
    const room = this.rooms.get(roomId)

    if (!room) {
      throw new Error(`Room with id ${roomId} not found`)
    }

    const client = room.clients.get(sessionId)

    if (!client) { return }
    // trigger room.onLeave(client)
    room.onLeave && room.onLeave(client, true)

    // stop tracking
    room.stopTracking(client)

    return this.removeRoomClient(room, client)
  }

  // close room
  public async closeRoom({ sessionId, roomId }: ICloseRoomData): Promise<void> {
    // get room
    const room = this.rooms.get(roomId)

    if (!room) {
      throw new Error(`Room with id ${roomId} not found`)
    }

    if (room.hostId && room.hostId !== sessionId) {
      throw new Error(`Only host can close Room with id ${roomId}`)
    }

    room.terminated = true

    // terminate all room clients
    for (const client of room.clients.values()) {
      // skip reservations
      if (!client) { continue }

      // trigger room.onLeave(client)
      room.onLeave && room.onLeave(client, true)

      // terminate client
      client.terminate(ErrorCode.NormalClose, "Room closed")

      // stop tracking and remove client
      room.stopTracking(client)
    }
    room.clients.clear()

    // remove room
    return this.removeRoom(room)
  }

  private async removeRoom(room: Room): Promise<void> {
    // call room on close
    room.onClose && await room.onClose()

    // clear room cache
    await this.cache.remove(room.id)

    // remove room
    this.rooms.delete(room.id)

    if (room instanceof LobbyRoom) {
      // unsubscribe lobby room
      this.inspector.unsubscribe(room.id, room.watch)
    }
  }
}

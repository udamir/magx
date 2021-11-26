import {
  IPCManager,
  ICreateRoomData, IJoinRoomData, ILeaveRoomData, ICloseRoomData, IUpdateRoomData, IRoomUpdate,
  IRoomObject, RoomManager, logger,
} from "./internal"

const log = logger("balancer", 34)

interface IProcesses {
  [pid: string]: { rooms: number, clients: number }
}

export class LoadBalancer {
  constructor(
    // server room manager
    public rooms: RoomManager,
    // ipc manager
    public ipcm: IPCManager,
  ) {
    // handle ipc requests
    ipcm.onRequest("createRoom", (data: ICreateRoomData) => this.rooms.createRoom(data))
    ipcm.onRequest("joinRoom", (data: IJoinRoomData) => this.rooms.joinRoom(data))
    ipcm.onRequest("updateRoom", (data: IUpdateRoomData) => this.rooms.updateRoom(data))
    ipcm.onRequest("leaveRoom", (data: ILeaveRoomData) => this.rooms.leaveRoom(data))
    ipcm.onRequest("closeRoom", (data: ICloseRoomData) => this.rooms.closeRoom(data))
  }

  public async findProcessForRoom(): Promise<string> {
    // get all processes id
    const pids = await this.ipcm.pids()

    log.debug(`Find process for room:`)
    // get all exisiting rooms
    const roomsCache = await this.rooms.cache.findMany()

    // count rooms count and clients count per process
    const processes: IProcesses = {}
    roomsCache.forEach((room: IRoomObject) => {
      if (pids.includes(String(room.pid))) {
        const { rooms = 0, clients = 0 } = processes[room.pid] || {}
        processes[room.pid] = { rooms: rooms + 1, clients: clients + room.clients.length }
      } else {
        this.rooms.cache.remove(room.key)
      }
    })

    log.debug(`Current process load:`, processes)

    // find process with min load
    let minLoad = Infinity
    let roomProcessId = this.ipcm.processId

    log.debug(`All cluster pids`, pids)
    for (const pid of pids) {
      const { rooms = 0, clients = 0 } = processes[pid] || {}
      if (rooms * clients >= minLoad) { continue }

      roomProcessId = pid
      minLoad = rooms * clients
    }
    return roomProcessId
  }

  public async createRoom(sessionId: string, name: string, options?: any): Promise<IRoomObject> {
    // find low loaded process for new room
    const pid = await this.findProcessForRoom()

    if (pid === this.ipcm.processId) {
      // create room on this process
      return this.rooms.createRoom({ sessionId, name, options })
    }

    // send request to process to create room
    return this.ipcm.requestProcess<ICreateRoomData, IRoomObject>(pid, "createRoom", { sessionId, name, options })
  }

  public async makeRequest(method: string, roomId: string, data: any): Promise<any> {
    // get room with id
    const room = await this.rooms.cache.get(roomId)

    if (!room) {
      throw new Error(`Cannot ${method} with id ${roomId} - room not found.`)
    }

    if (room.pid === this.ipcm.processId) {
      // execute method on this process
      switch (method) {
        case "joinRoom": return this.rooms.joinRoom(data)
        case "updateRoom": return this.rooms.updateRoom(data)
        case "leaveRoom": return this.rooms.leaveRoom(data)
        case "closeRoom": return this.rooms.closeRoom(data)
      }
    }

    // send request to process
    return this.ipcm.requestProcess(room.pid, method, data)
  }

  public async joinRoom(sessionId: string, roomId: string, options?: any): Promise<IRoomObject> {
    return this.makeRequest("joinRoom", roomId, { sessionId, roomId, options })
  }

  public async updateRoom(sessionId: string, roomId: string, update: IRoomUpdate): Promise<IRoomObject> {
    return this.makeRequest("updateRoom", roomId, { sessionId, roomId, update })
  }

  public async leaveRoom(sessionId: string, roomId: string): Promise<void> {
    return this.makeRequest("leaveRoom", roomId, { sessionId, roomId })
  }

  public async closeRoom(sessionId: string, roomId: string): Promise<void> {
    return this.makeRequest("closeRoom", roomId, { sessionId, roomId })
  }
}

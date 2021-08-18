import * as http from "http"

import {
  api, Router,
  ICache, LocalCache,
  RoomManager, RoomClass, IRoomObject,
  WebSocketTransport,
  Client, Transport, ErrorCode,
  IAuthManager, SessionAuth,
  IPCManager, LocalManager,
  LoadBalancer,
} from "./internal"

export interface IServerParams<T extends Transport> {
  // communication transport for clients
  // default: WebSocketTransport with port 8000
  transport?: T

  // cache for room's data (must be shared for cluster)
  // default: LocalCache
  roomCache?: ICache<IRoomObject>

  // inter process communication manager (required for cluster)
  // default: LocalManager
  ipcManager?: IPCManager

  // server process id (required for cluster)
  // default process.pid
  processId?: string | number

  // authentication manager (must be shared for cluster)
  // default: SessionAuth with LocalCache
  auth?: IAuthManager

  // api path prefix
  // default: "/magx"
  path?: string

  // client connection response timeout
  // default: 1000
  connectionTimeout?: number

  // id generator
  // default: Date.now().toString(32) + Math.random().toString(32).slice(3)
  generator?: (data?: any) => string
}

/**
 * MagX Server - Multiplayer authoritative game server
 */

export class Server<C extends Client = Client, T extends Transport<C> = Transport> {
  // http server
  public httpServer: http.Server | null = null

  // server http router
  public router: Router

  // transport
  public transport: T | WebSocketTransport

  // room manager
  public rooms: RoomManager

  // auth manager
  public auth: IAuthManager

  // load balancer
  public balancer: LoadBalancer

  // process id
  public processId: string | number

  // IPC manager
  public ipcm: IPCManager

  // id generator
  public generator: (data?: any) => string

  // client connection response timeout
  public connectionTimeout: number

  constructor(httpServer?: http.Server, params?: IServerParams<T>) {
    params = params || {} as IServerParams<T>

    this.processId = params.processId || process.pid

    // use transport or create default
    this.transport = params.transport || new WebSocketTransport({
      server: httpServer,
      pingInterval: 1500,
      maxPingRetries: 2,
    })

    // set connection timeout
    this.connectionTimeout = params.connectionTimeout || 1000

    // handle connection of client
    this.transport.on("connect", async (client: C, query: string) => {
      // get session by token
      const auth = await this.auth.verify(query)

      if (!auth) {
        // terminate client without session
        return client.terminate(ErrorCode.Unathorized, "Unathorized")
      }

      // save session to client
      client.auth = auth
      // connct client to room
      this.rooms.onClientConnected(client)
    })

    // handle disconnection of client
    this.transport.on("disconnect", (client: C, code: number) => {
      // disconnect client from room
      this.rooms.onClientDisconnected(client, code)
    })

    // create IPC manager
    this.ipcm = params.ipcManager || new LocalManager()

    // create room manager
    const roomCache = params.roomCache || new LocalCache()
    this.rooms = new RoomManager(this, roomCache)

    // create session manager
    this.auth = params.auth || new SessionAuth(new LocalCache())

    // create loadbalancer
    this.balancer = new LoadBalancer(this.rooms, this.ipcm)

    // id generator
    this.generator = params.generator || (() => Date.now().toString(32) + Math.random().toString(32).slice(3))

    // create server router
    this.router = new Router()
    // attach server api to router
    this.router.attach(api(this, params.path || "/magx"))

    // attach router to httpServer
    if (httpServer) {
      this.attach(httpServer)
    }
  }

  // define server rooms
  public define(name: string, roomClass: RoomClass, params?: any): Server<C, T> {
    this.rooms.defineRoomType(name, roomClass, params)
    return this
  }

  // attach magx api to http server
  public attach(httpServer: http.Server) {
    this.httpServer = httpServer
    this.router.inject(httpServer)
  }

  // gracefull shutdown
  public async close() {
    await this.rooms.closeRooms()
    this.ipcm.terminate()
    this.transport.terminate()
  }
}

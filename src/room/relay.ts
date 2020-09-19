import { Room, Client, PatchListener, ITrackerParams, IJsonPatch } from "../internal"

interface IRelayRoomPlayer {
  data: any
  connected: boolean
}

interface IRelayRoomState {
  players: { [id: string]: IRelayRoomPlayer }
  [key: string]: any
}

export class RelayRoom extends Room {
  public maxPlayers!: number
  public reconnectionTimeout!: number
  public state!: IRelayRoomState
  public listeners!: Map<string, PatchListener<any>>

  public createState(): any {
    return this.state
  }

  public createPatchTracker() {
    return {
      onPatch: (listener: PatchListener<any>, params: any) => {
        const { clientId } = params
        this.listeners.set(clientId, listener)
        return () => { this.listeners.delete(clientId) }
      },
      snapshot: () => this.state,
      dispose: () => this.listeners.clear(),
    }
  }

  public startTracking(client: Client, params?: ITrackerParams) {
    super.startTracking(client, { ...params, clientId: client.id })
  }

  public onCreate(params: any) {
    this.listeners = new Map<string, PatchListener<any>> ()

    const state = params && params.state || {}
    this.state = { ...state, players: {} }

    this.data = params && params.data || {}
    this.reconnectionTimeout = params && params.reconnectionTimeout
    this.maxPlayers = params && params.maxPlayers || Infinity
  }

  public onJoin(client: Client, params: any) {
    this.addPlayer(client, params)

    client.send("room_state", this.state)
    this.broadcast("player_join", client.id, client.id)

    if (this.clients.size >= this.maxPlayers && !this.locked) {
      this.lock()
    }
  }

  public onMessage(client: Client, type: string, data: any) {
    try {
      switch (type) {
        case "patch_state": return this.patchState(client, data)
        case "update_room": return this.updateRoom(client, data)
        case "private_message": return this.sendMessage(client, data)
      }
      this.broadcast(type, data, client.id)
    } catch (error) {
      client.send("error", error)
    }
  }

  public async onLeave(client: Client, consented?: boolean) {

    if (!consented && this.reconnectionTimeout) {
      this.setPlayerConection(client, false)
      try {
        await this.waitReconnection(client, this.reconnectionTimeout)
        this.setPlayerConection(client, true)
        return
      } catch (e) { /** */ }
    }
    this.removePlayer(client)
    this.broadcast("player_leave", client.id, client.id)
  }

  public onClose() {
    this.broadcast("room_close", this.id)
  }

  public patchState(client: Client, patch: IJsonPatch) {
    const path = patch.path.substr(1).split("/")
    const key = path.pop() as any

    let obj = this.state as any
    path.forEach((id) => {
      if (!obj[id]) { obj[id] = +id ? [] : {} }
      obj = obj[id]
    })

    // apply patch to local state
    switch (patch.op) {
      case "add": case "replace":
        if (Array.isArray(obj) && +key) {
          obj.splice(+key, 0, patch.value)
        } else {
          obj[key] = patch.value
        }
        break
      case "remove":
        if (Array.isArray(obj) && +key) {
          obj.splice(+key, 1)
        } else {
          delete obj[key]
        }
        break
    }

    // notify listners
    this.listeners.forEach((listener, clientId) => {
      if (clientId === client.id) { return }
      listener(patch, obj, this.state)
    })
  }

  public updateRoom(client: Client, update: any) {
    if (client.id !== this.hostId) { return }

    switch (update.type) {
      case "locked":
        if (update.value !== this.locked) {
          this.locked = !!update.value
          this.updateCache()
        }
        break
      case "data": {
        this.data = update.value || {}
        this.updateCache()
      }
    }

    this.broadcast("update_room", update, client.id)
  }

  public sendMessage(client: Client, data: any) {
    const to = this.clients.get(data.clientId)
    if (!to) { return }

    to.send("private_message", { from: client.id, message: data.message })
  }

  public broadcastPatch(client: Client, patch: IJsonPatch) {
    // send patch to players
    this.listeners.forEach((listener, clientId) => {
      if (clientId === client.id) { return }
      listener(patch)
    })
  }

  public addPlayer(client: Client, params: any = {}) {
    const player = {
      connected: true,
      ...params,
    }
    if (!this.state.players) {
      this.state.players = {}
    }
    this.state.players[client.id] = player

    this.broadcastPatch(client, {
      op: "add",
      path: "/players/" + client.id,
      value: player,
    })
  }

  public removePlayer(client: Client) {
    if (!this.state.players) { return }
    delete this.state.players[client.id]

    this.broadcastPatch(client, {
      op: "remove",
      path: "/players/" + client.id,
    })
  }

  public setPlayerConection(client: Client, value: boolean) {
    const player = this.state.players && this.state.players[client.id]
    if (!player || player.connected === value) { return }

    player.connected = value

    this.broadcastPatch(client, {
      op: "replace",
      path: "/players/" + client.id + "/connected",
      value,
    })
  }

}

import { Room, Client, IRoomObject } from "../internal"

export interface ILobbyRoomParams {
  watch: string[]
}

export class LobbyRoom extends Room {
  public watch!: string[]
  public rooms: { [name: string]: IRoomObject[] } = {}
  public subscribers: Set<Client> = new Set()

  public getRooms: ((names: string[]) => Promise<IRoomObject[]>) | null = null

  public onRoomUpdate(roomId: string, data: IRoomObject | null) {
    this.subscribers.forEach((client) => client.send("room_update", { roomId, data }))
  }

  public onCreate(params: ILobbyRoomParams) {
    this.watch = params.watch || []
  }

  public async onJoin(client: Client) {
    if (this.getRooms) {
      client.send("rooms", await this.getRooms(this.watch))
      this.subscribers.add(client)
    }
  }

  public onLeave(client: Client) {
    this.subscribers.delete(client)
  }
}

import { Room, Client } from "magx"
import { Mosx, mx, SchemaSerializer } from "mosx"

const colors = ["red", "green", "yellow", "blue", "cyan", "magenta"]

@mx.Object
export class Player {
  @mx public x = Math.floor(Math.random() * 400)
  @mx public y = Math.floor(Math.random() * 400)
  @mx public color = colors[Math.floor(Math.random() * colors.length)]
}

@mx.Object
export class State {
  @mx public players = new Map<string, Player>()

  public local = "This attribute won't be tracked"

  public createPlayer(id: string) {
    const player = new Player()
    this.players.set(id, player)
  }

  public removePlayer(id: string) {
    this.players.delete(id)
  }

  public movePlayer(id: string, movement: any) {
    const player = this.players.get(id)
    if (!player) { return }
    player.x += movement.x ? movement.x * 10 : 0
    player.y += movement.y ? movement.y * 10 : 0
  }
}

export class MosxStateRoom extends Room<State> {

  public createState(): any {
    // create state
    return new State()
  }

  public createPatchTracker(state: State) {
    // create state change tracker
    return Mosx.createTracker(state, { serializer: SchemaSerializer })
  }

  public onCreate(params: any) {
    console.log("MosxStateRoom created!", params)
  }

  public onMessage(client: Client, type: string, data: any) {
    if (type === "move") {
      console.log(`MosxStateRoom received message from ${client.id}`, data)
      this.state.movePlayer(client.id, data)
    }
  }

  public onJoin(client: Client, params: any) {
    console.log(`Player ${client.id} joined MosxStateRoom`, params)
    client.send("hello", "world")
    this.state.createPlayer(client.id)
  }

  public onLeave(client: Client) {
      this.state.removePlayer(client.id)
  }

  public onClose() {
    console.log("MosxStateRoom closed!")
  }
}

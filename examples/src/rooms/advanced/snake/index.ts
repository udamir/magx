import { Room, Client } from "magx"
import { Mosx, SchemaSerializer } from "mosx"
import { SnakeState } from "./state"

export class SnakeRoom extends Room<SnakeState> {
  public size!: number
  public speed!: number

  public createState(): any {
    // create state
    return new SnakeState(this.size)
  }

  public createPatchTracker(state: SnakeState) {
    // create state change tracker
    return Mosx.createTracker(state, { serializer: SchemaSerializer })
  }

  public onCreate(params: { options: { id: string, size: number, speed: number }}) {
    // init room params
    const { id, size, speed } = params.options
    this.size = size || 20
    this.speed = speed || 10
    this.data = { id }
  }

  public onMessage(client: Client, type: string, dir: number) {
    if (type === "keypress" && this.state.phase === "game") {
      // update player velocity
      const player = this.state.players.get(client.id)
      player?.updateVelocity(dir)
    }
  }

  public onJoin(client: Client) {
    // create player
    this.state.createPlayer(client.id)

    if (this.clients.size >= 2) {
      this.lock()
      this.startGame()
    }
  }

  public startGame() {
    this.state.phase = "game"
    this.state.addFood()
    const intervalId = setInterval(() => {
      const looser = this.state.update()
      
      if (looser) {
        this.state.looser = looser
        clearInterval(intervalId);
      }
    }, 1000 / this.speed);
  }

  public async onLeave(client: Client) {
    // remove player
    this.state.removePlayer(client.id)
  }
}

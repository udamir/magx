import { Room, Client } from "magx"
import { Mosx, SchemaSerializer } from "mosx"
import { OpenWorldState, IPoint } from "./state"

export class OpenWorldRoom extends Room<OpenWorldState> {
  // room position in open world in "x:y" format
  public pos!: string
  // size of room square in open world
  public size!: number

  get rect() {
    const [ x, y ] = this.pos.split(":")
    return {
      left: Number(x) * this.size,
      right: Number(x) * this.size + this.size,
      top: Number(y) * this.size,
      bottom: Number(y) * this.size + this.size,
    }
  }

  get randomPos() {
    return {
      x: Math.floor(Math.random() * this.size) + this.rect.left,
      y: Math.floor(Math.random() * this.size) + this.rect.top,
    }
  }

  get randomColor() {
    return ["red", "green", "yellow", "blue", "cyan", "magenta"][Math.floor(Math.random() * 6)]
  }

  public createState(): any {
    // create state
    return new OpenWorldState(this.rect)
  }

  public createPatchTracker(state: OpenWorldState) {
    // create state change tracker
    return Mosx.createTracker(state, { serializer: SchemaSerializer })
  }

  public onCreate(params: { options: { id: string, size: number }}) {
    // init room params
    const { id, size } = params.options
    this.size = size || 200
    this.data = { id }
    this.pos = id
  }

  public onMessage(client: Client, type: string, pos: IPoint) {
    if (type === "move") {
      // update player position
      this.state.movePlayer(client.id, pos)
    }
  }

  public onJoin(client: Client, params: { pos: IPoint, color: string }) {
    // init player params
    const color = params.color || this.randomColor
    const pos = params.pos || this.randomPos

    // create player
    this.state.createPlayer(client.id, pos, color)

    // make visible for client all private objects in roomm with tag:"visible"
    this.updateTrackingParams(client, { tags: "visible" })
  }

  public async onLeave(client: Client) {
    // remove player
    this.state.removePlayer(client.id)
  }
}

import { Mosx, mx } from "mosx"

export interface IPoint {
  x: number
  y: number
}

export interface IRect {
  left: number
  right: number
  top: number
  bottom: number
}

// set player objects as private - to manage player visibility
@mx.Object.private
export class OpenWorldPlayer {
  @mx public x: number
  @mx public y: number
  @mx public color: string

  constructor(pos: IPoint, color: string) {
    this.x = pos.x || Math.floor(Math.random() * 400)
    this.y = pos.y || Math.floor(Math.random() * 400)
    this.color = color
  }
}

@mx.Object
class Rect {
  @mx public left: number
  @mx public right: number
  @mx public top: number
  @mx public bottom: number

  constructor(rect: IRect) {
    this.left = rect.left
    this.right = rect.right
    this.top = rect.top
    this.bottom = rect.bottom
  }
}

@mx.Object
export class OpenWorldState {
  // room's rect in openworld
  @mx public rect: Rect
  // room's players
  @mx public players = new Map<string, OpenWorldPlayer>()

  constructor(rect: IRect) {
    this.rect = new Rect(rect)
  }

  // check if player in room rect
  public inRect(player: OpenWorldPlayer) {
    return player.x >= this.rect.left && player.x <= this.rect.right
      && player.y >= this.rect.top && player.y <= this.rect.bottom
  }

  // create player
  public createPlayer(id: string, pos: IPoint, color: string) {
    const player = new OpenWorldPlayer(pos, color)
    this.players.set(id, player)

    // check if player visible in room
    if (this.inRect(player)) {
      // add tag to player
      Mosx.addTag(player, "visible")
    }
  }

  public removePlayer(id: string) {
    this.players.delete(id)
  }

  public movePlayer(id: string, pos: IPoint) {
    const player = this.players.get(id)
    if (!player) { return }

    // update player position
    player.x += pos.x ? pos.x * 10 : 0
    player.y += pos.y ? pos.y * 10 : 0

    // check if player visible after move
    const tags = Mosx.getTags(player)
    const visible = tags && tags.has("visible")
    // add or remove player visibility if needed
    if (!this.inRect(player)) {
      visible && Mosx.deleteTag(player, "visible")
    } else {
      !visible && Mosx.addTag(player, "visible")
    }
  }
}

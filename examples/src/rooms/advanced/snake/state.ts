import { mx } from "mosx"

@mx.Object
export class Point {
  @mx public x!: number
  @mx public y!: number

  constructor(x: number, y: number) {
    this.set(x, y)
  }

  public set(x: number, y: number) {
    this.x = x
    this.y = y
  }
}

@mx.Object
export class SnakePlayer {
  public x: number
  public y: number
  public vel: Point
  @mx public snake: Array<Point>

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
    this.vel = new Point(0, 0)
    this.snake = [new Point(x, y)]
  }

  public updateVelocity(dir: number) {
    switch (dir) {
      case 0:  // left
        return this.vel.set(-1, 0)
      case 1: // down
        return this.vel.set(0, -1)
      case 2: // right
        return this.vel.set(1, 0)
      case 3: // up
        return this.vel.set(0, 1)
    }
  }

  public onSnake(x: number, y: number) {
    for (const s of this.snake) {
      if (s.x === x && s.y === y) { return true }
    }
    return false
  }
}

@mx.Object
export class SnakeState {
  @mx public food = new Array<Point>()
  @mx public players = new Map<string, SnakePlayer>()
  @mx public gridSize: number
  @mx public phase: string
  @mx public looser: string

  constructor(gridSize: number) {
    this.gridSize = gridSize
    this.phase = "init"
    this.looser = ""
  }

  // create player
  public createPlayer(id: string) {
    const [x, y] = this.getEmptyCell()
    const player = new SnakePlayer(x, y)
    this.players.set(id, player)
  }

  public removePlayer(id: string) {
    this.players.delete(id)
  }

  public update() {
    for (const id of this.players.keys()) {
      const p = this.players.get(id)!
      if (p.vel.x || p.vel.y) {
        p.x += p.vel.x
        p.y += p.vel.y

        for (const pp of this.players.values()) {
          if (pp.onSnake(p.x, p.y)) { return id }
        }

        p.snake.push(new Point(p.x, p.y))

        if (p.x < 0 || p.x > this.gridSize || p.y < 0 || p.y > this.gridSize) {
          return id
        }

        let grow = false
        this.food.forEach((f, i) => {
          if (p.x === f.x && p.y === f.y) {
            grow = true
            this.food.splice(i, 1)
            if (!this.food.length) { this.addFood() }
          }
        })

        if (!grow) {
          p.snake.shift()
        }
      }
    }

    return ""
  }

  public getEmptyCell(): number[] {
    const x = Math.floor(Math.random() * this.gridSize)
    const y = Math.floor(Math.random() * this.gridSize)

    for (const p of this.players.values()) {
      if (p.onSnake(x, y)) {
        return this.getEmptyCell()
      }
    }

    return [x, y]
  }

  public addFood(): void {
    const [x, y] = this.getEmptyCell()

    this.food.push(new Point(x, y))
  }
}

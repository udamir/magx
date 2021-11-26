import { Server, Router, RequestHandler, IRequestContext } from "./internal"

export const api = (server: Server, prefix: string) => {

  const authorized: RequestHandler = async (ctx: IRequestContext, next?: () => Promise<void>): Promise<void> => {
    const token = ctx.headers.authorization || ""

    const auth = await server.auth.verify(token)
    if (!auth) {
      ctx.status = 403
      return
    }

    ctx.auth = auth
    return next && next()
  }

  return new Router(prefix)
    // get magx js client
    .get("/", Router.send(__dirname, "../../magx-client/dist/magx.js"))
    .get("/dev", Router.send(__dirname, "../../magx-client/dist/magx.dev.js"))
    // verify
    .get("/auth/:token", async (ctx: IRequestContext) => {
      ctx.body = await server.auth.verify(ctx.params.token)
      if (!ctx.body) { ctx.status = 404 }
    })
    // authenticate
    .post("/auth", async (ctx: IRequestContext) => {
      const id = ctx.payload.id || server.generator(ctx.payload.data)
      ctx.body = await server.auth.sign(id, ctx.payload.data)
    })
    // get room
    .get("/rooms/:id", authorized, async (ctx: IRequestContext) => {
      ctx.body = await server.rooms.getRoomObject(ctx.params.id)
      if (!ctx.body) { ctx.status = 404 }
    })
    // get rooms
    .get("/rooms", authorized, async (ctx: IRequestContext) => {
      ctx.body = await server.rooms.getAvaliableRooms(ctx.query.name)
    })
    // create room
    .post("/rooms", authorized, async (ctx: IRequestContext) => {
      ctx.body = await server.balancer.createRoom(ctx.auth.id, ctx.payload.name, ctx.payload.options)
    })
    // join room
    .post("/rooms/:id/join", authorized, async (ctx: IRequestContext) => {
      ctx.body = await server.balancer.joinRoom(ctx.auth.id, ctx.params.id, ctx.payload.options)
    })
    // update room
    .post("/rooms/:id/update", authorized, async (ctx: IRequestContext) => {
      ctx.body = await server.balancer.updateRoom(ctx.auth.id, ctx.params.id, ctx.payload.update)
    })
    // leave room
    .post("/rooms/:id/leave", authorized, async (ctx: IRequestContext) => {
      ctx.body = await server.balancer.leaveRoom(ctx.auth.id, ctx.params.id)
    })
    // close room
    .post("/rooms/:id/close", authorized, async (ctx: IRequestContext) => {
      ctx.body = await server.balancer.closeRoom(ctx.auth.id, ctx.params.id)
    })
}

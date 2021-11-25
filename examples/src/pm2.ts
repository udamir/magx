import * as Redis from "ioredis"
import { MongoClient } from "mongodb"
import { MongoCache, RedisManager, SessionAuth, WebSocketTransport, IServerParams } from "magx"

import { createServer } from "./server"

const port = Number(process.env.PORT || 3001)
const wsport = port + Number(process.env.NODE_APP_INSTANCE || 0) + 1
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379"
const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/magx"

let client: MongoClient
const redis = new Redis.default(redisUrl)

const processId = Math.random().toString(24).slice(3)
const ipcManager = new RedisManager(redis, { processId })

export const setup = async () => {
  // connect to mongodb
  client = await MongoClient.connect(mongoUrl, { keepAlive: true })

  // define server params
  const serverParams: IServerParams<WebSocketTransport> = {
    processId,
    ipcManager,
    // init websocket transport in worker port
    transport: new WebSocketTransport({ port: wsport }),
    // init cache on master node
    roomCache: new MongoCache(client.db() as any, "rooms"),
    // init session auth with cache on master node
    auth: new SessionAuth(new MongoCache(client.db() as any, "users")),
  }

  // create http server
  const server = createServer(serverParams)

  // start server
  server.listen(port, () => {
    console.info(`Server started on http://localhost:${port}, ws port: ${wsport}`)
  })
}

setup()

process.on("SIGINT", () => {
  client.close()
    .then(redis.quit)
    .then(ipcManager.close)
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
})

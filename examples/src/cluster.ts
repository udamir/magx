import * as cluster from "cluster"
import { cpus } from "os"

// import magx components
import {
  IServerParams, WebSocketTransport,
  IPCMaster, IPCWorker, IPCMasterCache, IPCWorkerCache,
  SessionAuth,
} from "magx"

import { createServer } from "./server"

if (cluster.isMaster) {
  // init ipc manager for master
  const ipcm = new IPCMaster()

  // add cache for rooms
  ipcm.use(IPCMasterCache("rooms"))
  // add cache for sessions
  ipcm.use(IPCMasterCache("sessions"))

  // Create a worker for each CPU
  for (const i of cpus()) {
    const worker = cluster.fork()
    // Add worker to icp manager
    ipcm.add("" + worker.process.pid, worker)
    console.log(`worker ${worker.process.pid} added to cluster`)
  }

  console.log("Master started")

} else {

  const processId = "" + cluster.worker.process.pid
  const workerPort = 3030 + cluster.worker.id

  // ipc manager
  const ipcManager = new IPCWorker(cluster.worker, { processId })

  // define server params
  const serverParams: IServerParams<WebSocketTransport> = {
    processId,
    ipcManager,
    // init websocket transport in worker port
    transport: new WebSocketTransport({ port: workerPort }),
    // init cache on master node
    roomCache: new IPCWorkerCache(ipcManager, "rooms"),
    // init session auth with cache on master node
    auth: new SessionAuth(new IPCWorkerCache(ipcManager, "sessions")),
  }

  // create http server
  const server = createServer(serverParams)

  // start server
  const port = process.env.PORT || 3001
  server.listen(port, () => {
    console.info(`Worker started on http://localhost:${port}`)
  })
}

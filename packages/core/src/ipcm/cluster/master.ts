import { Worker } from "cluster"

import { IProcessRequest, IProcessResponse } from ".."

export interface IWorkerMessage {
  event: string
  processId: string
  channel: string
  data?: any
}

export type WorkerListner = (processId: string, channel: string, data: any) => void

export type IMasterIPCMiddleware = (ipcm: IPCMaster, message: IWorkerMessage, next: () => void) => void

/**
 * IPC interface for master node
 */

export class IPCMaster {
  // list of workers
  public workers: { [pid: string]: Worker } = {}
  public subscribers: { [channel: string]: Set<string> } = {}
  public listners: { [event: string]: WorkerListner } = {}
  public middlewares: IMasterIPCMiddleware[] = []

  public add(pid: string, worker: Worker) {

    this.workers[pid] = worker

    // handle messages from worker
    worker.on("message", (message: IWorkerMessage) => this.nextMiddleware(0, message))
  }

  public use(middleware: IMasterIPCMiddleware) {
    this.middlewares.push(middleware)
  }

  public nextMiddleware(index: number, message: IWorkerMessage) {
    // console.log(`send request to middleware ${index + 1}/${this.middlewares.length}`)
    if (index < this.middlewares.length) {
      this.middlewares[index](this, message, () => this.nextMiddleware(index + 1, message))
    } else {
      this.onMessage(message)
    }
  }

  protected onMessage(message: IWorkerMessage) {
    const { event, processId, channel, data } = message

    switch (event) {
      // case "pids": return this.onPids(processId)
      case "subscribe": return this.onSubscribe(processId, channel)
      case "unsubscribe": return this.onUnsubscribe(processId, channel)
      case "publish": return this.onPublish(processId, channel, data)
    }
  }

  public onSubscribe(processId: string, channel: string): void {
    // init subscription channel
    if (!this.subscribers[channel]) {
      this.subscribers[channel] = new Set()
    }
    // add process to channel subscribers
    this.subscribers[channel].add(processId)
  }

  public onUnsubscribe(processId: string, channel: string): void {
    if (!this.subscribers[channel]) { return }

    // delete process from subscribers
    this.subscribers[channel].delete(processId)

    // delete channel if no subscribers
    if (!this.subscribers[channel].size) {
      delete this.subscribers[channel]
    }
  }

  public onPublish(processId: string, channel: string, data: IProcessRequest | IProcessResponse): void {
    if (!this.subscribers[channel]) { return }

    // send data to all subscribers
    for (const pid of this.subscribers[channel]) {

      // don't send data back to publisher
      // if (pid === processId) { continue } TODO: test case

      this.workers[pid].send({ channel, data })
    }
  }
}

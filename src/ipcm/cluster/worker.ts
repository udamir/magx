import { Worker } from "cluster"

import { logger } from "../../internal"
import { IPCManager, IPCParams, ProcessListner } from "../"
import { IWorkerMessage } from "./master"

const log = logger("ipcm/cluster", 32)

/**
 * IPC interface for worker node
 */

export interface IMasterMessage {
  channel: string
  data?: any
}

interface IPidsRequest {
  resolve: (data: any) => any
  timer: NodeJS.Timer
}

export class IPCWorker extends IPCManager {
  public pidsRequest: IPidsRequest | null = null
  public listeners: { [channel: string]: ProcessListner<any> }

  constructor(public worker: Worker, params: IPCParams) {
    super(params)
    this.listeners = {}

    process.on("message", this.onMessage.bind(this))

    this.init()
  }

  protected onMessage(message: IMasterMessage) {
    const { channel, data } = message

    // pids response from master
    if (!channel && this.pidsRequest) {
      // clear timeout timer
      clearTimeout(this.pidsRequest.timer)
      // resolve request
      return this.pidsRequest.resolve(data)
    }

    log.debug(`Worker ${this.processId} recieved message ${channel} from master`, this.listeners[channel])

    // response to listner
    if (!this.listeners[channel]) { return }

    this.listeners[channel](data)
  }

  public send(message: IWorkerMessage) {
    if (!process.send) { return }
    process.send(message)
  }

  public async pids(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pidsRequest = null
        log.error("REJECT: pids timeout error")
        reject("Request timeout")
      }, this.timeout)

      this.pidsRequest = { resolve, timer }

      log.debug(`Worker ${this.processId} requested for pids`)
      this.send({ event: "pids", processId: this.processId, channel: "" })
    })
  }

  public subscribe(channel: string, listner: ProcessListner<any>): void {
    this.listeners[channel] = listner
    this.send({ event: "subscribe", processId: this.processId, channel })
  }

  public unsubscribe(channel: string): void {
    delete this.listeners[channel]
    this.send({ event: "unsubscribe", processId: this.processId, channel })
  }

  public publish(channel: string, data: any): void {
    this.send({ event: "publish", processId: this.processId, channel, data })
  }
}

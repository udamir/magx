import { Worker } from "cluster"

import { IPCManager, IPCParams, IProcessState, ProcessListener } from ".."
import { IWorkerMessage } from "./master"

/**
 * IPC interface for worker node
 */

export interface IMasterMessage {
  channel: string
  data?: any
}

export class IPCWorker<T extends IProcessState = any> extends IPCManager<T> {
  public listeners: { [channel: string]: ProcessListener<any> }

  constructor(public worker: Worker, params: IPCParams<T>) {
    super(params)
    this.listeners = {}

    process.on("message", this.onMessage.bind(this))

    this.init()
  }

  protected onMessage(message: IMasterMessage) {
    const { channel, data } = message

    // response to listner
    if (!this.listeners[channel]) { return }

    this.listeners[channel](data)
  }

  public send(message: IWorkerMessage) {
    if (!process.send) { return }
    process.send(message)
  }

  public subscribe(channel: string, listner: ProcessListener<any>): void {
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

  public close() {
    return
  }
}

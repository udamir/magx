import { IPCManager, ProcessListner } from "../../internal"

export class LocalManager extends IPCManager {
  public channels: { [id: string]: ProcessListner<any> } = {}

  constructor() {
    super({
      processId: "" + process.pid,
    })
  }

  public async requestProcess<T, R>(id: string | number, method: string, data: T): Promise<R> {
    const listener = this.requestHandlers[method]
    if (!listener) {
      throw new Error(`Process ${id} cannot execute ${method} - method  not found.`)
    }
    return listener(data)
  }

  public async pids(): Promise<string[]> {
    return [this.processId]
  }

  public subscribe(channel: string, listner: ProcessListner<any>): void {
    this.channels[channel] = listner
  }

  public unsubscribe(channel: string): void {
    delete this.channels[channel]
  }

  public publish(channel: string, data: any): void {
    const listner = this.channels[channel]
    return listner && listner(data)
  }
}

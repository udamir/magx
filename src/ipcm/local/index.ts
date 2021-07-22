import { IProcessState } from ".."
import { IPCManager, ProcessListener } from ".."

export class LocalManager<S extends IProcessState> extends IPCManager<S> {
  public channels: { [id: string]: ProcessListener<any> } = {}

  constructor() {
    super({
      processId: "" + process.pid,
    })
  }

  public async requestProcess<T>(id: string | number, method: string, data: T): Promise<any> {
    const listener = this.requestHandlers[method]
    if (!listener) {
      throw new Error(`Process ${id} cannot execute ${method} - method  not found.`)
    }
    return listener(data)
  }

  public subscribe(channel: string, listener: ProcessListener<any>): void {
    this.channels[channel] = listener
  }

  public unsubscribe(channel: string): void {
    delete this.channels[channel]
  }

  public publish(channel: string, data: any): void {
    const listener = this.channels[channel]
    return listener && listener(data)
  }

  public close() {
    return
  }
}

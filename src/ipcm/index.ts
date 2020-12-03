/**
 * Abstract class for inter-process communication in cluster
 */

export interface IPCParams {
  timeout?: number
  processId: string
}

export type IPCRequestHandler = (data: any) => Promise<any>
export type ProcessListner<T> = (data: T) => void

export interface IProcessRequest {
  requestId: string
  method: string
  data: any
}

export interface IProcessResponse {
  error?: any
  data?: any
}

export abstract class IPCManager {
  public processId: string
  public timeout: number
  public requestHandlers: { [method: string]: IPCRequestHandler }

  constructor(params: IPCParams) {
    this.processId = params.processId
    this.timeout = params.timeout || 1000
    this.requestHandlers = {}
  }

  public init() {
    this.subscribe(`ipc-request:${this.processId}`, (request: IProcessRequest) => {
      const { requestId, method , data } = request
      const listner = this.requestHandlers[method]
      if (!listner) { return }
      listner(data)
        .then((result: any) => {
          this.publish(`ipc-response:${requestId}`, { data: result })
        })
        .catch((error: any) => {
          this.publish(`ipc-response:${requestId}`, { error })
        })
    })
  }

  public async requestProcess<T, R>(id: string | number, method: string, data: T): Promise<R> {
    return new Promise((resolve, reject) => {
      const requestId = Date.now().toString(36) + Math.random().toString(36).slice(3)

      const timer = setTimeout(() => {
        this.unsubscribe(`ipc-response:${requestId}`)
        console.debug("REJECT: ipcm requestProcess timeout error")
        reject(`IPC request timeout. Process: ${this.processId}, method: ${method}`)
      }, this.timeout)

      this.subscribe(`ipc-response:${requestId}`, (response: IProcessResponse) => {
        clearTimeout(timer)
        this.unsubscribe(`ipc-response:${requestId}`)

        if (response.error) {
          console.log("REJECT: ipcm requestProcess error")
          reject(response.error)
        } else {
          resolve(response.data)
        }
      })

      this.publish(`ipc-request:${id}`, { requestId, method, data })

    })
  }

  public onRequest(method: string, handler: IPCRequestHandler) {
    this.requestHandlers[method] = handler
  }

  public abstract pids(): Promise<string[]>
  public abstract subscribe(channel: string, listner: ProcessListner<any>): void
  public abstract unsubscribe(channel: string): void
  public abstract publish(channel: string, data: any): void

}

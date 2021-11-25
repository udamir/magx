/**
 * Abstract class for process discovery and communication
 */

export type IPCRequestHandler<T = any> = (data: any) => Promise<T>
export type ProcessListener<T> = (data: T) => void

export interface IProcessRequest {
  requestId: string
  method: string
  data: any
}

export interface IProcessResponse {
  error?: any
  data?: any
}

export interface IProcessState {
  [key: string]: any
}

export interface IPCParams<T extends IProcessState> {
  timeout?: number
  state?: T
  processId: string
  instanceName?: string
  healthCheckInterval?: number
}

export interface IProcessInstance<T extends IProcessState> {
  ttl: number
  state: T
}

export interface IProcessInfo<T extends IProcessState> {
  id: string
  state: T
}

export abstract class IPCManager<S extends IProcessState = any> {
  public processId: string
  public timeout: number
  public healthCheckInterval: number
  public requestHandlers: { [method: string]: IPCRequestHandler }
  public state: S
  public instances: Map<string, IProcessInstance<S>>
  private healthCheckTimeout?: NodeJS.Timeout
  private instanceName: string

  constructor(params: IPCParams<S>) {
    this.processId = params.processId
    this.timeout = params.timeout || 1000
    this.instanceName = params.instanceName = "instance"
    this.requestHandlers = {}
    this.instances = new Map<string, IProcessInstance<S>>()
    this.healthCheckInterval = params?.healthCheckInterval || 30000
    this.state = params?.state || {} as S
  }

  public init() {
    this.subscribe(`${this.instanceName}:add`, (id: string) => {
      // handle new instance
      this.addInstance(id)
      console.log(`Process ${this.processId}: added instance ${id} [${this.instances.size}]`)

      this.publish(`${id}:discovery`, { id: this.processId, state: this.state })
    })

    this.subscribe(`${this.instanceName}:delete`, (id: string) => {
      this.deleteInstance(id)
    })

    this.subscribe(`${this.processId}:discovery`, ({ id, state }: IProcessInfo<S>) => {
      if (id === this.processId) { return }
      this.addInstance(id)
      console.log(`Process ${this.processId}}: added instance ${id} [${this.instances.size}]`)
      this.updateInstanceState(id, state)
    })

    this.subscribe(`ipc-request:${this.processId}`, (request: IProcessRequest) => {
      const { requestId, method , data } = request
      const listener = this.requestHandlers[method]
      if (!listener) { return }
      listener(data)
        .then((result: any) => {
          this.publish(`ipc-response:${requestId}`, { data: result })
        })
        .catch((error: any) => {
          this.publish(`ipc-response:${requestId}`, { error })
        })
    })

    this.instances.set(this.processId, { state: this.state, ttl: -1 })
    this.publish(`${this.instanceName}:add`, this.processId)
    this.startHealthCheck()
  }

  public startHealthCheck() {
    if (this.healthCheckTimeout) {
      this.stopHealthCheck()
    }

    this.healthCheckTimeout = setInterval(() => {
      // send instance info
      this.publishState()

      // check instances health
      for (const [id, { ttl }] of this.instances.entries()) {
        if (ttl > 0 && ttl < Date.now()) {
          this.deleteInstance(id)
        }
      }
    }, this.healthCheckInterval)
  }

  public terminate() {
    this.publish(`${this.instanceName}:delete`, this.processId)
    close()
  }

  public stopHealthCheck() {
    if (!this.healthCheckTimeout) { return }
    clearInterval(this.healthCheckTimeout)
    this.healthCheckTimeout = undefined
  }

  public publishState() {
    // publish state
    this.publish(`${this.processId}:info`, this.state)
  }

  private addInstance(id: string) {
    this.subscribe(`${id}:info`, (state: S) => {
      if (id === this.processId) { return }
      // on instance info
      this.updateInstanceState(id, state)
    })
  }

  private updateInstanceState(id: string, state: S) {
    const ttl = Date.now() + this.healthCheckInterval * 2
    this.instances.set(id, { state, ttl })

    if (this.instances.size > 1 && !this.healthCheckTimeout) {
      this.startHealthCheck()
    }
  }

  private deleteInstance(id: string) {
    this.unsubscribe(`${id}:info`)
    this.instances.delete(id)

    if (this.instances.size < 2) {
      this.stopHealthCheck()
    }
  }

  public async requestProcess<L, R>(id: string | number, method: string, data: L): Promise<R> {
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

  public pids(): string[] {
    return [ ...this.instances.keys() ]
  }

  public abstract subscribe<T>(channel: string, listener: ProcessListener<T>): void
  public abstract unsubscribe(channel: string): void
  public abstract publish<T>(channel: string, data: T): void
  public abstract close(): void
}

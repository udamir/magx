import type { Redis } from "ioredis"
import { IPCManager, IPCParams, IProcessState, ProcessListener } from "."

export class RedisManager<S extends IProcessState> extends IPCManager<S> {
  public handlers: { [id: string]: ProcessListener<any> } = {}
  public pub: Redis
  public sub: Redis

  constructor(redis: Redis, params?: IPCParams<S>) {
    super({ ...params, processId: params?.processId || Date.now().toString(24) })
    this.pub = redis.duplicate()
    this.sub = redis.duplicate()
    this.sub.on("message", (channel, message) => {
      if (!this.handlers[channel]) { return }
      this.handlers[channel](JSON.parse(message))
    })
    this.init()
  }

  public subscribe(channel: string, listener: ProcessListener<any>): void {
    this.sub.subscribe(channel)
    console.log(`${this.processId} subscribed for channel: ${channel}`)
    this.handlers[channel] = listener
  }

  public unsubscribe(channel: string): void {
    this.sub.unsubscribe(channel)
    console.log(`${this.processId} unsubscribed from channel: ${channel}`)
    delete this.handlers[channel]
  }

  public publish(channel: string, data: any): void {
    this.pub.publish(channel, JSON.stringify(data))
    console.log(`${this.processId} publish to channel: ${channel}`, data)
  }

  public close() {
    this.sub.quit()
    this.pub.quit()
  }
}

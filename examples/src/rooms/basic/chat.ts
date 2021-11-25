import { Room, Client } from "magx"

export class ChatRoom extends Room {

  public onCreate(params: any) {
    console.log("ChatRoom created!", params)
  }

  public onMessage(client: Client, type: string, data: any) {
    console.log("ChatRoom received message from", client.id, ":", data)
    this.broadcast("messages", `(${client.id}) ${data}`)
  }

  public onJoin(client: Client) {
    this.broadcast("messages", `${ client.id } joined.`)
  }

  public onLeave(client: Client) {
    this.broadcast("messages", `${ client.id } left.`)
  }

  public onClose() {
    console.log("ChatRoom closed!")
  }

}

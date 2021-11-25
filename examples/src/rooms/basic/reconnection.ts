import { Room, Client } from "magx"

export class ReconnectionRoom extends Room {
  public onCreate(params: any) {
    console.log("ReconnectionRoom created!", params)
  }

  public onJoin(client: Client, options: any) {
    client.send("status", "Welcome!")
  }

  // when the user disconnects, wait for reconnection
  public async onLeave(client: Client, consented?: boolean) {

    if (!consented) {
      try {
        // wait for reconnection
        client = await this.waitReconnection(client, 60)
        console.log("Reconnected!")

        client.send("status", "Welcome back!")

        return
      } catch (error) {
        console.log(error)
      }
    }
  }

  public onClose() {
    console.log("ReconnectionRoom closed!")
  }

}

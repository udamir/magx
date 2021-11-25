import { Room, Client } from "magx"
import { Mosx, SchemaSerializer } from "mosx"

import { ChatState } from "./state"

export class MosxChatRoom extends Room<ChatState> {

  public createState(): any {
    // create state
    return new ChatState()
  }

  public createPatchTracker(state: ChatState) {
    // create state change tracker
    return Mosx.createTracker(state, { serializer: SchemaSerializer })
  }

  public onJoin(client: Client) {
    // add client and save username
    const user = this.state.addUser(client.id, { name: client.data.username })

    // update tags for client
    this.updateTrackingParams(client, { tags: [ user.privateTag, this.state.publicTag ] })
  }

  public onMessage(client: Client, type: string, data: any) {
    // handle messages from client
    switch (type) {
      case "message": return this.onTextMessage(client, data)
      case "typing": return this.setClientTyping(client.id, true)
      case "idle": return this.setClientTyping(client.id, false)
    }
  }

  public onTextMessage(client: Client, data: any) {
    // get user by id
    const user = this.state.users.get(client.id)
    if (!user) { return }
    // send message from user
    if (data.to && data.to.length) {
      this.state.addPrivateMessage(user, data.message, data.to)
    } else {
      this.state.addPublicMessage(user, data.message)
    }
    user.incMessages()
  }

  public setClientTyping(id: string, typing: boolean) {
    // get user by id
    const user = this.state.users.get(id)
    if (!user) { return }
    // update user typing status
    user.typing = typing
  }

  // when the user disconnects, wait for reconnection
  public async onLeave(client: Client) {
    const user = this.state.users.get(client.id)
    if (!user) { return }

    // update user online status
    user.online = false
    try {
      // wait for reconnection
      client = await this.waitReconnection(client, 30)
      // if reconnected update user online status
      user.online = true
    } catch (error) {
      // else remove user
      this.state.removeUser(client.id)
    }
  }
}

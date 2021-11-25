import { Mosx, mx } from "mosx"

@mx.Object.private // private object
export class ChatMessage {
  // public properties
  @mx public id: string = Math.random().toString(36).substr(2)
  @mx public date: number = Date.now()
  @mx public userId: string
  @mx public text: string

  constructor(userId: string, text: string) {
    this.userId = userId
    this.text = text
  }
}

@mx.Object
export class ChatUser {
  // public properties
  @mx public id: string
  @mx public name: string
  @mx public typing: boolean = false
  @mx public online: boolean = true
  // private property
  @mx.private public messages: number = 0

  public privateTag: string

  constructor(id: string, name: string, tag: string) {
    this.id = id
    this.name = name
    this.privateTag = tag
  }

  public setTyping(value: boolean) {
    this.typing = value
  }

  public incMessages() {
    this.messages++
  }
}

@mx.Object
export class ChatState {
  // public properties
  @mx public users = new Map<string, ChatUser>()
  @mx public messages = new Array<ChatMessage>()

  public publicTag: string = "public"

  public addUser(id: string, data: any) {
    const tag = Math.random().toString(36).slice(3)
    // create user
    const user = new ChatUser(id, data.name, tag)
    // add tag to user
    Mosx.addTag(user, tag)
    
    this.users.set(id, user)
    return user
  }

  public removeUser(sessionId: string) {
    this.users.delete(sessionId)
  }

  public addPublicMessage(from: ChatUser, text: string) {
    // create message with public tag and owner tags (inherit from parent)
    const message = new ChatMessage(from.id, text)
    // add public tag to message
    Mosx.addTag(message, this.publicTag)

    // push will trigger patches for all
    this.messages.push(message)
  }

  public addPrivateMessage(from: ChatUser, text: string, to: string[]) {
    // create message
    const message = new ChatMessage(from.id, text)
    // add owner tags to message
    Mosx.setParent(message, from)

    // add client's tag to message
    to.forEach((userId) => {
      const user = this.users.get(userId)
      user && Mosx.addTag(message, user.privateTag)
    })

    // push will trigger patches for users in list "to"
    this.messages.push(message)
  }
}

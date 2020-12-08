# MagX

<img alt="npm" src="https://img.shields.io/npm/v/magx"> <img alt="npm" src="https://img.shields.io/npm/dm/magx?label=npm"> <img alt="npm type definitions" src="https://img.shields.io/npm/types/magx"> <img alt="GitHub" src="https://img.shields.io/github/license/udamir/magx">

Multiplayer Game Server Framework for Node.js

## What is MagX?

Magx is a Multiplayer Game Server Framework for Node.js: server-authoritative multiplayer approach is supported as well as relayed multiplayer (also known as client-authoritative).

In server-authoritative multiplayer approach room state maintained on the server and clients are just visual representations of the current game state. Each client can send messages to change room state, these messages can be validated by server and state changes broadcast to room clients. This enables you to build:

1. Asynchronous real-time authoritiative multiplayer: Fast paced realtime multiplayer. Messages are sent to the server, server calculates changes to the environment and players and data is broadcasted to relevant peers. This typically requires a high tick-rate for the gameplay to feel responsive.

2. Active turn-based multiplayer: Like with Stormbound or Clash Royale mobile games where two or more players are connected and are playing a quick turn-based match. Players are expected to respond to turns immediately. The server receives input, validates them and broadcast to players. The expected tick-rate is quite low as rate of message sent and received is low.

To create Authoritative Multiplayer server you need Flexible State Mangement with change tracking functionality. [MosX](https://github.com/udamir/mosx) is default state managment engine, but you have the freedom and flexibility to choose state managment engine without limitations.

In relayed multiplayer approach each client is act as the host of reconcile state changes between peers and perform arbitration on ambiguous or malicious messages sent from bad clients. So each client sends all state changes to server and server broadcasted them to otherr clients without inspection. This approach can be very useful for many types of gameplay but may not suitable for gameplay which depends on central state managed by the game server.

## Summary
MagX provides to you:
- WebSocket-based communication
- Simple API in the server-side and client-side.
- Automatic state synchronization between server and client.
- Scale vertically or horizontally
- Fully customizable

## Getting started

### From examples project

The easiest way to try out MagX is using the [magx-example](https://github.com/udamir/magx-examples) project:
## Installation

```
git clone https://github.com/udamir/magx-examples.git
cd magx-examples
npm install
```

To run the MagX server, run ```npm start```

### Build basic Chat server from scratch

1. Install magx package:
```
npm install --save magx
```

2. Create a simple chat room handler (chatRoom.ts):
```typescript
import { Room, Client } from "magx"
export class ChatRoom extends Room {
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
```

3. Create MagX server and define chatRoom (index.ts):
```typescript
import * as http from "http"
import { Server } from "magx"
import { ChatRoom } from "./chatRoom"
const server = http.createServer()
const magx = new Server(server)
magx.define("chat", ChatRoom)
const port = process.env.PORT || 3001
server.listen(port, () => {
  console.log(`Magx server started on http://localhost:${port}`)
})
```

Chat server is ready!

4. Create basic index.html page and attach magx-client:
```html
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width" />

    <!-- magx client -->
    <script type="text/javascript" src="/magx"></script>

  </head>
  <body>
    <strong>Messages</strong><br>

    <form id="form">
      <input type="text" id="input" value="" autofocus/>
      <input type="submit" value="send" />
    </form>

    <div id="messages"></div>

    <script>
      // add js code here
    </script>
  </body>
</html>
```

5. Connect to MagX server, authenticate and join ChatRoom:
```js
const { host, port, protocol } = window.document.location
var client = new MagX.Client({ address: host.replace(/:.*/, ''), port, secure: protocol === "https:" })
client.authenticate()
  .then(() => client.getRooms("chat"))
  .then(rooms => rooms.length ? client.joinRoom(rooms[0].id) : client.createRoom("chat"))
  .then(room => {
    console.log("joined")
    // listen to messages coming from the server
    room.onMessage("messages", (message) => {
      var p = document.createElement("p");
      p.innerText = message;
      document.querySelector("#messages").appendChild(p);
    })
    // send message to room on submit
    document.querySelector("#form").onsubmit = function(e) {
      e.preventDefault();
      var input = document.querySelector("#input");
      console.log("input:", input.value);
      // send data to room
      room.send("message", input.value);
      // clear input
      input.value = "";
    }
  })
```

Simple chat is ready! You can open several tabs, send and recieve messags.

## Documentation
soon...

## License

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fudamir%2Fmagx.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fudamir%2Fmagx?ref=badge_large)

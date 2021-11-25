# Magx JS client
<img alt="npm" src="https://img.shields.io/npm/v/magx-client"> <img alt="npm" src="https://img.shields.io/npm/dm/magx-client?label=npm"> <img alt="CircleCI" src="https://img.shields.io/circleci/build/github/udamir/magx-client?token=71d65bfb5432f9a6e372fd71a8edfe7e733b693f"> <img alt="GitHub" src="https://img.shields.io/github/license/udamir/magx-client">


JavaScript/TypeScript Client for MagX multiplayer game server.

## Installation

### Installing the module
```
npm install --save magx-client
```
and include it to your project
```ts
import { Client } from "magx-client"
```


### CDN link

```html
<script src="https://cdn.jsdelivr.net/npm/magx-client@0.7.1/dist/magx.js"></script>
```

or you can include magx-client package to server dependencies and use it on client:

```html
<script src="/magx"></script>
```

## Usage

### Connecting to server
```js
var client = new MagX.Client({ address: "localhost", port: 3001, secure: true })

// Authenticate
await client.authenticate({ login, password })

// or verify your session
await client.verify(token)

// Get avaliable rooms
const rooms = await client.getRooms("lobby")

// create new room
const room = await client.createRoom(name, params)

// or join to existing room
const room = await client.joinRoom(roomId, params)

// or reconnect to room
const room = await client.reconnect(roomId)
```

### Handle room events
```js
// new room state
room.onSnapshot((state) => {
  console.log("initial room state:", state)
})

// listen to patches coming from the server
room.onPatch((patch) => {
  // this signal is triggered on each patch
  console.log("room state patch:", patch)
})

// listen to messages coming from the server
room.onMessage("move", (data) => {
  // this signal is triggered on each "move" message
  console.log("new move message:", data)
})

// listen to specified state changes
room.onChange("replace", "object/:id/*", (patch, { id }) => updateObject(id, patch))

// short alias for onChange event
room.onAdd("players/:id", (patch, { id }) => addPlayer(id, patch.value)
room.onRemove("players/:id", (patch, { id }) => removePlayer(id))
room.onReplace("players/:id/:prop", (patch, { id, prop }) => updatePlayer(id, prop, patch.value))

// server error occurred
room.onError((code, message) => {
  console.log("error", code, message);
})

// client left the room
room.onLeave(() => {
  console.log(client.id, "left");
})
```

### Use room methods
```js
// send message
room.send(type, data)

// leave room
room.leave()

// close room
room.close() {

// update room params
room.update(update)
```

## Examples

The easiest way to try out magx-client is using the magx-example:
```
git clone https://github.com/udamir/magx-examples.git
cd magx-examples
npm install
```
To run the MagX server, run ```npm start```

# License
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fudamir%2Fmagx-client.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fudamir%2Fmagx-client?ref=badge_large)

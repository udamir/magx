import * as http from "http"

import { Server, IServerParams, LobbyRoom, Router, RelayRoom } from "magx"
import { monitor } from "magx-monitor"

// Import demo room handlers
import {
  MosxChatRoom,
  ChatRoom,
  MosxStateRoom,
  OpenWorldRoom,
  ReconnectionRoom,
  SnakeRoom,
} from "./rooms"

export const createServer = (params?: IServerParams<any>) => {

  const server = http.createServer()

  const magx = new Server(server, params)
    .define("mosx-chat", MosxChatRoom)
    .define("lobby", LobbyRoom, { watch: ["mosx-chat", "chat", "mosx-state", "reconnection", "relay", "open-world"] })
    .define("chat", ChatRoom, {
      custom_options: "you can use me on Room#onCreate",
    })
    .define("relay", RelayRoom)
    .define("reconnection", ReconnectionRoom)
    .define("mosx-state", MosxStateRoom)
    .define("open-world", OpenWorldRoom)
    .define("snake", SnakeRoom)

  monitor(magx)

  // attach public dir routes
  magx.router.attach(Router.static(__dirname + "/../public"))

  return server
}

const { host, port, protocol } = window.document.location

const serializer = MagX.SchemaSerializer
const id = sessionStorage.getItem("sessionId")
const token = sessionStorage.getItem("token")
const client = new MagX.Client({ address: host.replace(/:.*/, ''), port, secure: protocol === "https:", token, id, serializer })

const chatStore = {
  state: { 
    username: "",
    room: null,
    typing: false,
    lastTypingTime: 0
  }, 
  getters: { 
    username: ({ username }) => username,
    room: ({ room }) => room,
    id: () => client && client.auth && client.auth.id || ""
  },
  mutations: {
    setUserName(state, name) { 
      state.username = name
    },
    setRoom(state, room) {
      state.room = room
    },
    setTyping(state, value) {
      state.typing = value
      if (value) {
        state.lastTypingTime = Date.now()
      }
    },
  },
  actions: {
    async reconnect({ state, dispatch, commit }) {
      try {
        const roomId = sessionStorage.getItem("roomId")
        const username = sessionStorage.getItem("username")
        const room = await client.reconnect(roomId)
        console.log("Reconnected")
        commit("setUserName", username)
        dispatch("handleRoom", room)
      } catch (error) {
        console.log("Cannot reconnect", error)
        sessionStorage.removeItem("sessionId")
        sessionStorage.removeItem("token")
        sessionStorage.removeItem("username")
        sessionStorage.removeItem("roomId")
        commit("setUserName", "")
      }
    },
    async auth({ commit }, data) {
      console.log("Auth", data)
      const session = await client.authenticate(data)
      console.log("Session", data, session)
      commit("setUserName", session.data.username)
      sessionStorage.setItem("sessionId", session.id)
      sessionStorage.setItem("token", session.token)
      sessionStorage.setItem("username", session.data.username)
    },
    async joinChat({ dispatch }) {

      const rooms = await client.getRooms("mosx-chat")

      console.log("Avaliable rooms:", rooms)
      room = rooms.length 
        ? await client.joinRoom(rooms[0].id) 
        : await client.createRoom("mosx-chat")
    
      if (room) {
        dispatch("handleRoom", room)
        console.log("Joined room!")
      } else {
        console.log("Cannot join room!")
      }
    },
    handleRoom({ commit, dispatch }, room) {
      commit("setRoom", room)
      sessionStorage.setItem("roomId", room.id)

      room.onPatch((patch) => {
        console.log("onPatch", patch)
        dispatch("mosx_patch", patch)
      })

      room.onSnapshot((snapshot) => {
        console.log("onSnapshot", snapshot)
        dispatch("mosx_snapshot", snapshot)
      })
    },
    sendMessage({ state }, { message, to }) {
      state.room.send("message", { message, to })
    },
    startTyping({ state, commit, dispatch }) {
      if (!state.typing) {
        state.room.send('typing');
        commit("setTyping", true)
        dispatch("checkTyping", 1000)
      } else {
        commit("setTyping", true)
      }
    },
    stopTyping ({ state, commit }) {
      if (state.typing) {
        state.room.send('idle')
        commit("setTyping", false)
      }
    },
    checkTyping({ state, dispatch }, inteval = 0) {
      setTimeout(() => {
        if (Date.now() - state.lastTypingTime < inteval) {
          dispatch("checkTyping", inteval)
        } else {
          dispatch("stopTyping")
        }
      }, inteval)
    }
  }
}

Vue.component('pages', {
  computed: {
    room() { return this.$store.getters.room },
    username() { return this.$store.getters.username }
  },
  async mounted() {
    await this.$store.dispatch("reconnect")
  },
  template: `
    <div>
      <chat-page v-if="!!room && !!username" tag="li" />
      <login-page v-else tag="li" />
    </div>
  `
})

Vue.component('chat-page', {
  data: () => ({
    newMessage: '',
    activeUsers: []
  }),
  computed: {
    id() { return this.$store.getters.id },
    users() { return this.$store.state.sync.users || {} },
    messages() { return (this.$store.state.sync.messages || []).filter(m => !!m) },
    userIds() { return Object.keys(this.users) || [] },
    sendTo() { return this.activeUsers.length ? this.activeUserNames.join(", ") : "all users"},
    activeUserNames() { return this.activeUsers.map(id => this.users[id].name) }, 
    me() { return this.users[this.id] || {} }
  },
  methods: {
    sendMessage() {
      if (this.newMessage) {
        this.$store.dispatch("stopTyping")
        this.$store.dispatch("sendMessage", { message: this.newMessage, to: this.activeUsers })
        this.newMessage = ''
      }
    },
    startTyping(key) {
      if (key.code === "MetaLeft" || key.code === "Enter") { return }
      this.$store.dispatch("startTyping")
    },
    status(userId) {
      const user = this.users[userId] || {}
      if (!user.online) return user.name + ": offline"
      if (user.typing) return user.name + ": typing..."
      return user.name
    },
    userParams(userId) {
      return this.activeUsers.indexOf(userId) >= 0 ? "active" : ""
    },
    userSelect(userId) {
      const index = this.activeUsers.indexOf(userId)
      if (index >= 0) {
        this.activeUsers.splice(index, 1)
      } else {
        this.activeUsers.push(userId)
      }
    }
  },
  template: `
    <div class="container page">
      <ul class="Users">
        <span class="header info">{{ me.name }}: {{ me.messages }} messages</span>
        <span class="header">Select users to send private message:</span>
        <li class="User" v-for="id in userIds" :key="id" :class="userParams(id)" @click="userSelect(id)"> {{ status(id) }} </li>
      </ul>

      <ul class="messages">
        <chat-message v-for="message in messages" :key="message.id" :message="message" />
      </ul>

      <div class="input">
        <span class="header">Input message you want to send to: {{ sendTo }} </span>
        <input class="inputMessage" v-model="newMessage" placeholder="Type here..." v-on:keyup="startTyping" v-on:keyup.enter="sendMessage" />
      </div>
    </div>
  `
})

Vue.component('clients-panel', {
  data: () => ({
    items: [
      { title: 'Dashboard', icon: 'mdi-view-dashboard' },
      { title: 'Photos', icon: 'mdi-image' },
      { title: 'About', icon: 'mdi-help-box' },
    ],
  }),
  template: `
    <div class="clients-panel">
    </div>
  `
})

Vue.component('chat-message', {
  props: ['message'],
  computed: {
    users() { return this.$store.state.sync.users },
  },
  methods: {
    name(userId) { 
      return this.users[userId] && this.users[userId].name
    },
    color(username) {
      const COLORS = [
        '#e21400', '#91580f', '#f8a700', '#f78b00',
        '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
        '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
      ]
      let hash = 7;
      for (var i = 0; i < username.length; i++) {
         hash = username.charCodeAt(i) + (hash << 5) - hash;
      }
      // Calculate color
      return COLORS[Math.abs(hash % COLORS.length)]
    }
  },
  template: `
    <li class="message">
      <span class="username" :style="'color: ' + color(message.userId)">{{ name(message.userId) }}</span>
      <span class="messageBody">{{ message.text }}</span>
    </li>
  `
})

Vue.component('login-page', {
  data: () => ({
    username: ''
  }),
  methods: {
    async submit() {
      if (this.username) {
        await this.$store.dispatch("auth", { username: this.username })
        await this.$store.dispatch("joinChat")
      }
    }
  },
  template: `
    <li class="login page">
      <div class="form">
        <h3 class="title">What's your nickname?</h3>
        <input class="usernameInput" v-model="username" type="text" maxlength="14" v-on:keyup.enter="submit" />
      </div>
    </li>
  `
})
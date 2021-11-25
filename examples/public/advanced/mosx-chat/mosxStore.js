
const mosxStore = {
  state: {}, 
  mutations: {
    setState(state, snapshot) {
      Object.keys(snapshot).forEach((key) => Vue.set(state, key, snapshot[key]))
    },
    add(state, { value, key, path }) {
      let obj = state
      path.forEach(id => obj = obj[id])
      if (Array.isArray(obj) && +key) {
        obj.splice(+key, 0, value)
      } else {
        Vue.set(obj, key, value) // set value
      }
    },
    replace(state, { value, key, path }) {
      let obj = state
      path.forEach(id => obj = obj[id])
      if (Array.isArray(obj) && +key) {
        Vue.set(obj, +key, value) // update array value
      } else {
        Vue.set(obj, key, value) // update object value
      }
    },
    remove(state, { path, key }) {
      let obj = state
      path.forEach(id => obj = obj[id])
      if (Array.isArray(obj) && +key) {
        obj.splice(+key, 1)
      } else {
        Vue.delete(obj, key)
      }
    }
  },
  actions: {
    mosx_snapshot({ commit }, snapshot) {
      commit("setState", snapshot)
    },
    mosx_patch({ commit }, { op, value, path }) {
      path = path.substr(1).split("/")
      commit(op, { value, key: path.pop(), path }) 
    }
  }
}

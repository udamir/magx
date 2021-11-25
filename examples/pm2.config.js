module.exports = {
  apps : [{
    port: 3001,
    name        : "server",
    script      : "./dist/pm2.js",
    exec_mode   : "cluster_mode",
    instances   : -1,
    env: {
      PORT      : 3001 // the port on which the app should listen
    }
  }]
}
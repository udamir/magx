import { createServer } from "./server"

// create http server
const server = createServer()

// start server
const port = process.env.PORT || 3001
server.listen(port, () => {
  console.info(`Server started on http://localhost:${port}`)
})

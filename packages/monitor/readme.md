# Magx monitoring console

## How to install package:
```
npm install --save magx-monitor
```

## How to use
```js
  const server = http.createServer()
  const magx = new Server(server, params)

  monitor(magx, { 
    serializer: "schema", // Support schema serializer
    secret: "monitor" // authentication secret
  })

  const port = process.env.PORT || 3001
  server.listen(port, () => {
    console.info(`Server started on http://localhost:${port}`)
  })
```

Access the Monitoring console on http://localhost:3001/magx/monitor in your browser.

## License
MIT

export interface ISendResponse extends Response {
  data?: any
}

export interface ISend {
  (method: string, uri: string, opts?: any, auth?: string): Promise<ISendResponse>
  get: (uri: string, opts?: any, auth?: string) => Promise<ISendResponse>
  post: (uri: string, opts?: any, auth?: string) => Promise<ISendResponse>
  put: (uri: string, opts?: any, auth?: string) => Promise<ISendResponse>
  patch: (uri: string, opts?: any, auth?: string) => Promise<ISendResponse>
  del: (uri: string, opts?: any, auth?: string) => Promise<ISendResponse>
}

export const send: ISend = (method: string, uri: string, opts?: any, auth?: string) => {
  opts = opts || {}
  opts.method = method
  opts.timeout = opts.timeout || 5000
  opts.headers = opts.headers || {}

  if (opts.body && typeof opts.body === "object") {
    opts.headers["Content-Type"] = "application/json"
    opts.body = JSON.stringify(opts.body)
  }

  if (auth) {
    opts.headers.Authorization = auth
  }

  if (opts.withCredentials) {
    opts.credentials = "include"
  }

  let timer: NodeJS.Timer

  return new Promise((resolve, reject) => {
    if (opts.timeout) {
      timer = setTimeout(() => {
        reject("timeout")
      }, opts.timeout)
    }
    fetch(uri, opts).then((response: ISendResponse) => {
      clearTimeout(timer)

      // apply(response, response) // => response.headers
      const reply = response.status >= 400 ? reject : resolve

      const tmp = response.headers.get("content-type")
      if (!tmp || tmp.indexOf("application/json") < 0) {
        reply(response)
      } else {
        response.text().then((str) => {
          try {
            response.data = str && JSON.parse(str, opts.reviver) || {}
            reply(response)
          } catch (err) {
            // apply(response, err)
            reject(err)
          }
        })
      }
    }).catch((error: any) => {
      reject(error)
    })
  })
}

send.get = send.bind(send, "GET")
send.post = send.bind(send, "POST")
send.patch = send.bind(send, "PATCH")
send.del = send.bind(send, "DELETE")
send.put = send.bind(send, "PUT")

import { StringDecoder } from "string_decoder"
import { readFileSync, existsSync } from "fs"
import { join, extname } from "path"
import * as http from "http"
import * as url from "url"

export interface IRequestContext {
  // request
  path: string
  method: string
  params: { [key: string]: string }
  query: { [key: string]: string | string[] }
  headers: http.IncomingHttpHeaders
  payload?: any
  auth?: any
  // response
  attachment?: string
  status?: number
  body?: any
  buffer?: string
  type?: string
}

export type RequestHandler = (ctx: IRequestContext, next?: () => Promise<void>) => Promise<void>

export interface IParam {
  name: string
  index: number
}

export interface IRoute {
  method: string
  path: string
  handlers: RequestHandler[]
  params: IParam[]
}

export class Router {
  public prefix: string
  public routes: IRoute[] = []
  public extantions: Router[] = []

  constructor(prefix: string = "") {
    this.prefix = prefix.replace(/^\/+|\/+$/g, "")
  }

  public attach(router: Router) {
    this.extantions.push(router)
  }

  public inject(httpServer: http.Server) {
    // save all server listeners
    const listeners = httpServer.listeners("request").slice(0)

    // attach api listener
    httpServer.removeAllListeners("request")
    httpServer.on("request", (req: http.IncomingMessage, res: http.ServerResponse) => {
      // check if requested api route
      const route = this.has(req.method || "", req.url || "")
      if (route) {
        // handle api request
        this.exec(route, req, res)
      } else {
        // call saved listeners
        for (const listener of listeners) {
          listener.call(httpServer, req, res)
        }
      }
    })
  }

  public has(reqMethod: string, reqUrl: string): IRoute | null {
    const parsedURL = url.parse(reqUrl, true)
    if (!parsedURL.pathname) {
      return null
    }
    reqUrl = parsedURL.pathname.replace(/^\/+|\/+$/g, "")

    // check if request url match router prefix
    if (reqUrl.substring(0, this.prefix.length) !== this.prefix) {
      return null
    }

    reqMethod = reqMethod && reqMethod.toLocaleLowerCase() || ""
    let route = this.routes.find(({ path, method }) => {

      const pathArr = (this.prefix + path)
        .replace(/^\/+|\/+$/g, "")
        .split("/")
        .map((item) => item[0] === ":" ? "[A-Za-z0-9_.\-]+" : item)

      const pathEnd =  (path.slice(-1) === "?") ? `(\/${pathArr.pop()})?$` : "$"
      const regExpPath = new RegExp(pathArr.join("\/") + pathEnd)
      return method === reqMethod && regExpPath.test(reqUrl)
    }) || null

    if (!route) {
      for (const router of this.extantions) {
        route = router.has(reqMethod, reqUrl.slice(this.prefix.length))
        if (route) { break }
      }
    }

    return route
  }

  public exec(route: IRoute, req: http.IncomingMessage, res: http.ServerResponse) {
    const parsedURL = url.parse(req.url || "", true)
    const path = (parsedURL.pathname || "").replace(/^\/+|\/+$/g, "")

    let buffer = ""

    const pathArr = path.split("/")

    const params = {} as any
    route.params.forEach((param) => {
      params[param.name] = pathArr[param.index]
    })

    const decoder = new StringDecoder("utf-8")
    let index = 0
    const ctx: IRequestContext = {
      path,
      query: parsedURL.query,
      params,
      headers: req.headers,
      method: (req.method || "").toLowerCase(),
    }

    const next = async () => {
      await route.handlers[index++](ctx, next)
    }

    req.on("data", (chunk) => buffer += decoder.write(chunk))

    req.on("end", async () => {
      buffer += decoder.end()
      if (req.headers["content-type"]?.includes("application/json")) {
        ctx.payload = JSON.parse(buffer)
      } else {
        ctx.payload = buffer
      }
      try {
        await next()
      } catch (error) {
        ctx.status = 400
        ctx.body = error
      }
      const headers: http.OutgoingHttpHeaders = {
        "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
        "Access-Control-Allow-Methods": "OPTIONS, POST, GET",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Max-Age": 2592000,
      }

      if (ctx.attachment) {
        headers["Content-Disposition"] = `attachment; filename=${ctx.attachment}`
      }
      if (ctx.buffer) {
        headers["Content-Type"] = `text/${ctx.type}; charset=utf-8`
      } else if (ctx.body) {
        headers["Content-Type"] = "application/json"
      }
      res.writeHead(ctx.status || 200, headers)
      res.end(ctx.buffer || JSON.stringify(ctx.body) || "")
    })
  }

  public addRoute(method: string, path: string, handlers: RequestHandler[]) {
    const pathArr = (this.prefix + path).replace(/^\/+|\/+$|\?+$/g, "").split("/")
    const params: IParam[] = []
    pathArr.forEach((item, index) => item[0] === ":" && params.push({ name: item.slice(1), index }))
    this.routes.push({ method, path, handlers, params })
    return this
  }

  public get(path: string, ...handlers: RequestHandler[]) {
    return this.addRoute("get", path, handlers)
  }

  public post(path: string, ...handlers: RequestHandler[]) {
    return this.addRoute("post", path, handlers)
  }

  public delete(path: string, ...handlers: RequestHandler[]) {
    return this.addRoute("post", path, handlers)
  }

  public static send(...paths: string[]) {
    const path = join(...paths)
    return async (ctx: IRequestContext): Promise<void> => {
      try {
        ctx.type = extname(path).slice(1)
        ctx.buffer = await readFileSync(path, { encoding: "utf-8" })
      } catch (error) {
        ctx.status = 404
      }
    }
  }

  public static static(path: string): Router {
    const router = new Router()
    router.has = (reqMethod: string, reqUrl: string): IRoute | null => {
      // check if file exist
      reqUrl = reqUrl || "/"
      let fullpath = join(path, reqUrl)
      if (reqUrl.slice(-1) === "/") {
        fullpath += "index.html"
      }
      if (reqMethod !== "get" || !existsSync(fullpath)) {
        return null
      }

      const route: IRoute = {
        method: "get",
        path: fullpath,
        handlers: [ Router.send(fullpath) ],
        params: [],
      }
      return route
    }
    return router
  }
}

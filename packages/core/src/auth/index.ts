export interface IAuth<T = any> {
  // session id
  id: string
  // token
  token: string
  // custom session data
  data?: T
}

export interface IAuthManager {
  // sign auth with token
  sign<T>(id?: string, data?: T): Promise<IAuth>

  // get auth by token
  verify(token: string): Promise<IAuth | null>
}

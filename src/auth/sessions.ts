import { ICache, IAuth, IAuthManager } from "../internal"

export class SessionAuth implements IAuthManager {

  constructor(public cache: ICache<IAuth>) {}

  /**
   * Create session
   * @param id - session id, default generated
   * @param token - session secret token, default: generated
   * @param data - any session data
   */
  public async sign<T>(id: string, data?: T): Promise<IAuth> {
    // create token
    const token = Math.random().toString(36).slice(3)

    // save session to cache
    const session: IAuth = { id, token, data }
    await this.cache.set(id, session)

    // return session
    return session
  }

  // get session by token
  public async verify(token: string): Promise<IAuth | null> {
    const session = await this.cache.findOne({ token })
    return session || null
  }

}

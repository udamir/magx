export type IDisposer = () => void

export interface IJsonPatch {
  op: "replace" | "add" | "remove"
  path: string
  value?: any
}

export interface IReversibleJsonPatch extends IJsonPatch {
  oldValue?: any
}

export type PatchListner<T> = (change: IJsonPatch | IReversibleJsonPatch, obj?: any, root?: T) => void

export interface IStateTracker<T> {
  onPatch: (listner: PatchListner<T>, params?: any) => IDisposer
  snapshot: (params?: any) => { [key: string]: any }
  dispose: () => void
}

export type IDisposer = () => void

export interface IJsonPatch {
  op: "replace" | "add" | "remove"
  path: string
  value?: any
}

export interface IReversibleJsonPatch extends IJsonPatch {
  oldValue?: any
}

export interface IEncodedJsonPatch extends IReversibleJsonPatch {
  encoded?: Buffer
}

export type PatchListener<T> = (patch: IJsonPatch, obj?: any, root?: T) => void

export interface IStateTracker<T> {
  onPatch(listner: PatchListener<T>, params?: any): IDisposer
  snapshot(params?: any): { [key: string]: any }
  dispose(): void
  decodeMap(serializer?: string): any
}

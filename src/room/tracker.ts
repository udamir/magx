export type IDisposer = () => void

export interface IJsonPatch {
  op: "replace" | "add" | "remove"
  path: string
  value?: any
  oldValue?: any
  compressed?: Int8Array
}

export interface ISchema {
  index: number
  name: string
  props: Array<string>
  types: Array<string>
}

export type PatchListener<T> = (patch: IJsonPatch, obj?: any, root?: T) => void

export interface IStateTracker<T> {
  onPatch: (listner: PatchListener<T>, params?: any) => IDisposer
  snapshot: (params?: any) => { [key: string]: any }
  dispose: () => void
  schema?: ISchema
}

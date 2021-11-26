import { IJsonPatch, IReversibleJsonPatch, JsonPatchOp, PatchPack } from "patchpack"

export interface ISerializer {
  encodeState(state: any): Buffer
  decodeState(buffer: Buffer): any

  encodePatch(patch: IJsonPatch): Buffer
  decodePatch(buffer: Buffer): IJsonPatch
}

export class MpackSerializer implements ISerializer {
  encodeState(state: any): Buffer {
    return PatchPack.encode(state)
  }

  decodeState(buffer: Buffer): any {
    return PatchPack.decode(buffer)
  }

  encodePatch(patch: IReversibleJsonPatch): Buffer {
    const op = ["add", "replace", "remove"].indexOf(patch.op)
    const patchArr = [op, patch.path]

    if ("value" in patch) {
      patchArr.push(patch.value)
    }

    if ("oldValue" in patch) {
      patchArr.push(patch.oldValue)
    }

    return PatchPack.encode(patchArr)
  }

  decodePatch(buffer: Buffer): IReversibleJsonPatch {
    const patchArr = PatchPack.decode(buffer).reverse()

    const patch: IReversibleJsonPatch = {
      op: ["add", "replace", "remove"][patchArr.pop()] as any,
      path: patchArr.pop(),
    }

    if (patchArr.length && patch.op !== "remove") {
      patch.value = patchArr.pop()
    }

    if (patchArr.length && patch.op !== "add") {
      patch.oldValue = patchArr.pop()
    }

    return patch
  }
}

export class LightSerializer implements ISerializer {
  private schema: any = {}
  private index: string[] = []

  encodeState(state: any): Buffer {
    return PatchPack.encode([this.schema, state])
  }

  decodeState(buffer: Buffer): any {
    const encodedState = PatchPack.decode(buffer)
    this.schema = encodedState[0]
    Object.keys(this.schema).forEach((key) => {
      this.index[this.schema[key].index] = key
    })
    return encodedState[1]
  }

  encodePatch(patch: IJsonPatch): any {
    return []
  }

  decodePatch(buffer: Buffer): IReversibleJsonPatch {
    const op = ["add", "replace", "remove"][buffer[0]] as JsonPatchOp
    const offset = buffer[1]
    const params = PatchPack.decode(buffer.slice(offset + 2))

    let path = ""
    let paramIndex = 0

    for (let i = 2; i < offset + 2; i += 1) {
      const schemaIndex = buffer[i]
      if (schemaIndex < 0) {
        path += "/" + params[paramIndex++]
      } else {
        const typeSchema = this.schema[this.index[schemaIndex]]
        path += "/" + typeSchema.props[buffer[++i]]
      }
    }

    if (params.length - paramIndex > 1) {
      return { op, path, value: params[paramIndex], oldValue: params[paramIndex + 1] }
    } else if (params.length - paramIndex > 0) {
      return { op, path, value: params[paramIndex] }
    } else {
      return { op, path }
    }
  }
}

export class SchemaSerializer implements ISerializer {
  private pp = new PatchPack()

  encodeState(state: any): Buffer {
    return this.pp.encodeState(state, true, false)
  }

  decodeState(buffer: Buffer): any {
    return this.pp.decodeState(buffer)
  }

  encodePatch(patch: IJsonPatch): Buffer {
    return this.pp.encodePatch(patch, false)
  }

  decodePatch(buffer: Buffer): IJsonPatch {
    return this.pp.decodePatch(buffer)
  }
}

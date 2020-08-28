
const modules = {
  "room/inspector": ["*"],
  "ipcm/cluster": ["*"],
}

export const logger = (module: string, color: number) => {
  // const set = modules[module]
  return {
    info: (...args: any[]) => {
      console.info(`\x1b[${color}m`, ...args, `\x1b[0m`)
    },
    error: (...args: any[]) => {
      console.error(`\x1b[${color}m`, ...args, `\x1b[0m`)
    },
    debug: (...args: any[]) => {
      console.debug(`\x1b[${color}m`, ...args, `\x1b[0m`)
    },
  }
}

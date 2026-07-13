import { app } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'

let logPath: string | null = null

export function initAliasLogger() {
  try {
    const userDataPath = app.getPath('userData')
    const logsDir = path.join(userDataPath, 'logs')
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true })
    }
    logPath = path.join(logsDir, 'alias_misses.log')
    console.log('[AliasLogger] Initialized at:', logPath)
  } catch (error) {
    console.error('[AliasLogger] Failed to initialize:', error)
  }
}

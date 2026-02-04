import { appendFile } from 'fs/promises'
import { getSystemLogPath } from './paths'
import { ensureDataDirs } from './storage'
import { nowIso } from './time'

type LogLevel = 'info' | 'warn' | 'error'
type LogMetaValue = string | number | boolean | undefined
type LogMeta = Record<string, LogMetaValue>

const formatMeta = (meta?: LogMeta): string => (meta ? ` ${JSON.stringify(meta)}` : '')

const formatLine = (level: LogLevel, message: string, meta?: LogMeta): string =>
  `${nowIso()} [${level.toUpperCase()}] ${message}${formatMeta(meta)}`

const writeLine = async (line: string): Promise<void> => {
  try {
    await ensureDataDirs()
    await appendFile(getSystemLogPath(), `${line}\n`, 'utf-8')
  } catch {
    // Logging must never block pipeline flow.
  }
}

const log = async (level: LogLevel, message: string, meta?: LogMeta): Promise<void> => {
  const line = formatLine(level, message, meta)
  if (level === 'error') {
    console.error(line)
  } else {
    console.log(line)
  }
  await writeLine(line)
}

export const logInfo = async (message: string, meta?: LogMeta): Promise<void> =>
  log('info', message, meta)

export const logWarn = async (message: string, meta?: LogMeta): Promise<void> =>
  log('warn', message, meta)

export const logError = async (message: string, meta?: LogMeta): Promise<void> =>
  log('error', message, meta)

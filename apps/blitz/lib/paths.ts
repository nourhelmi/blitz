import path from 'path'

const getRootDir = (): string => process.cwd()

export const getDataDir = (): string =>
  process.env.BLITZ_DATA_DIR ?? path.join(getRootDir(), 'data')

export const getDocumentsDir = (): string => path.join(getDataDir(), 'documents')

export const getLogsDir = (): string => path.join(getDataDir(), 'logs')

export const getSpecPath = (): string => path.join(getDataDir(), 'spec.json')

export const getTasksPath = (): string => path.join(getDataDir(), 'tasks.json')

export const getStatePath = (): string => path.join(getDataDir(), 'state.json')

export const getClarificationsPath = (): string => path.join(getDataDir(), 'clarifications.json')

export const getContextPath = (): string => path.join(getDataDir(), 'blitz-context.md')

export const getDocumentPath = (id: string, name: string): string =>
  path.join(getDocumentsDir(), `${id}-${sanitizeFilename(name)}`)

export const getTaskLogPath = (taskId: string): string =>
  path.join(getLogsDir(), `${sanitizeFilename(taskId)}.log`)

export const getSystemLogPath = (): string => path.join(getLogsDir(), 'system.log')

const sanitizeFilename = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'file'

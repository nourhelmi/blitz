import { mkdir, readFile, writeFile } from 'fs/promises'
import { z } from 'zod'
import { getDataDir, getDocumentsDir, getLogsDir } from './paths'

// Centralized file IO keeps validation + persistence aligned.

export const ensureDataDirs = async (): Promise<void> => {
  await Promise.all([
    mkdir(getDataDir(), { recursive: true }),
    mkdir(getDocumentsDir(), { recursive: true }),
    mkdir(getLogsDir(), { recursive: true }),
  ])
}

export const readJsonFile = async <T>(
  path: string,
  schema: z.ZodType<T>,
  fallback: T
): Promise<T> => {
  try {
    const raw = await readFile(path, 'utf-8')
    return schema.parse(JSON.parse(raw))
  } catch (error) {
    if (isMissingFile(error as { code?: string })) {
      await writeJsonFile(path, fallback)
      return fallback
    }
    throw error
  }
}

export const writeJsonFile = async <T>(path: string, value: T): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

export const readTextFile = async (path: string): Promise<string> =>
  readFile(path, 'utf-8')

export const writeTextFile = async (path: string, value: string): Promise<void> =>
  writeFile(path, value, 'utf-8')

const isMissingFile = (error: { code?: string }): boolean => error.code === 'ENOENT'

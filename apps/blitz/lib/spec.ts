import { readFile } from 'fs/promises'
import { SpecSchema, type Spec } from './schema'
import { ensureDataDirs, writeJsonFile } from './storage'
import { getSpecPath } from './paths'

export const getSpec = async (): Promise<Spec | undefined> => {
  await ensureDataDirs()
  try {
    const raw = await readFile(getSpecPath(), 'utf-8')
    return SpecSchema.parse(JSON.parse(raw))
  } catch (error) {
    if (isMissingFile(error as { code?: string })) return undefined
    throw error
  }
}

export const saveSpec = async (spec: Spec): Promise<Spec> => {
  const next = SpecSchema.parse(spec)
  await ensureDataDirs()
  await writeJsonFile(getSpecPath(), next)
  return next
}

export const updateSpec = async (patch: Partial<Spec>): Promise<Spec> => {
  const current = await getSpec()
  if (!current) throw new Error('Spec not found.')
  const next = SpecSchema.parse({ ...current, ...patch })
  await saveSpec(next)
  return next
}

const isMissingFile = (error: { code?: string }): boolean => error.code === 'ENOENT'

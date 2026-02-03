import { StateSchema, type State } from './schema'
import { ensureDataDirs, readJsonFile, writeJsonFile } from './storage'
import { getStatePath } from './paths'

const defaultState = StateSchema.parse({})

export const getState = async (): Promise<State> => {
  await ensureDataDirs()
  return readJsonFile(getStatePath(), StateSchema, defaultState)
}

export const saveState = async (state: State): Promise<void> => {
  const next = StateSchema.parse(state)
  await ensureDataDirs()
  await writeJsonFile(getStatePath(), next)
}

export const updateState = async (updater: (state: State) => State): Promise<State> => {
  const current = await getState()
  const next = updater(current)
  await saveState(next)
  return next
}

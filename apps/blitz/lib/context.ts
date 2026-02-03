import { appendFile, access } from 'fs/promises'
import { getContextPath } from './paths'
import { ensureDataDirs, writeTextFile } from './storage'

const baseContext = `# Blitz Context

Shared context for cross-task coordination. Each agent should:
1. READ this file at the start of their task
2. APPEND their decisions/discoveries before finishing

---

`

export const initContextFile = async (): Promise<void> => {
  await ensureDataDirs()
  try {
    await access(getContextPath())
  } catch {
    await writeTextFile(getContextPath(), baseContext)
  }
}

export const appendContext = async (context: string): Promise<void> => {
  await ensureDataDirs()
  await appendFile(getContextPath(), `\n${context.trim()}\n`, 'utf-8')
}

import { readFile } from 'fs/promises'
import path from 'path'

const promptsDir = (): string => path.join(process.cwd(), 'prompts')

export const loadPrompt = async (name: string): Promise<string> =>
  readFile(path.join(promptsDir(), name), 'utf-8')

export const renderPrompt = (template: string, variables: Record<string, string>): string =>
  Object.entries(variables).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    template
  )

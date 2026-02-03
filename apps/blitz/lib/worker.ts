import { spawn } from 'child_process'
import { createInterface } from 'readline'
import type { Spec, Task } from './schema'
import { loadPrompt, renderPrompt } from './llm/prompts'

export type AgentResult = {
  success: boolean
  result?: string
  context?: string
}

export type AgentProcess = {
  pid: number
  onOutput: (callback: (line: string) => void) => void
  wait: () => Promise<AgentResult>
  kill: () => void
}

type StreamEvent = {
  type?: string
  message?: {
    content?: Array<{ type?: string; text?: string }>
  }
  result?: string
}

let sessionTemplate: string | undefined

export const spawnAgent = async (task: Task, spec: Spec): Promise<AgentProcess> => {
  if (process.env.BLITZ_DRY_RUN === 'true') return createSimulatedAgent(task)
  return spawnClaudeCode(task, spec)
}

const spawnClaudeCode = async (task: Task, spec: Spec): Promise<AgentProcess> => {
  const prompt = await buildSessionPrompt(task, spec)
  const cwd = spec.working_directory ?? process.cwd()
  const useDocker = process.env.BLITZ_USE_DOCKER === 'true'

  const proc = useDocker
    ? spawn(
        'docker',
        [
          'sandbox',
          'run',
          '--credentials',
          'host',
          'claude',
          '--verbose',
          '--print',
          '--output-format',
          'stream-json',
          prompt,
        ],
        { cwd }
      )
    : spawn(
        'claude',
        ['--verbose', '--print', '--output-format', 'stream-json', '-p', prompt],
        { cwd }
      )

  const outputCallbacks: Array<(line: string) => void> = []
  let finalResult: string | undefined
  let fullOutput = ''

  // Stream-json output needs line-by-line parsing to extract assistant text and final result.
  const onLine = (line: string): void => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) {
      outputCallbacks.forEach((cb) => cb(line))
      return
    }
    try {
      const event = JSON.parse(trimmed) as StreamEvent
      if (event.type === 'assistant' && event.message?.content) {
        event.message.content.forEach((part) => {
          const text = part.text
          if (part.type === 'text' && typeof text === 'string' && text.length > 0) {
            fullOutput += text
            outputCallbacks.forEach((cb) => cb(text))
          }
        })
      }
      if (event.type === 'result' && event.result) {
        finalResult = event.result
      }
    } catch {
      outputCallbacks.forEach((cb) => cb(line))
    }
  }

  const stdout = createInterface({ input: proc.stdout })
  const stderr = createInterface({ input: proc.stderr })
  stdout.on('line', onLine)
  stderr.on('line', (line) => outputCallbacks.forEach((cb) => cb(`[stderr] ${line}`)))

  return {
    pid: proc.pid ?? 0,
    onOutput: (cb) => outputCallbacks.push(cb),
    wait: () =>
      new Promise((resolve) => {
        proc.on('exit', (code) => {
          const success =
            code === 0 || Boolean(finalResult?.includes('<promise>COMPLETE</promise>'))
          const contextMatch = fullOutput.match(
            /<blitz-context>([\s\S]*?)<\/blitz-context>/i
          )
          resolve({
            success,
            result: finalResult,
            context: contextMatch ? contextMatch[1]?.trim() : undefined,
          })
        })
      }),
    kill: () => proc.kill(),
  }
}

const buildSessionPrompt = async (task: Task, spec: Spec): Promise<string> => {
  if (!sessionTemplate) {
    sessionTemplate = await loadPrompt('session.md')
  }
  return renderPrompt(sessionTemplate, {
    TASK_ID: task.id,
    TASK_TITLE: task.title,
    TASK_DESCRIPTION: task.description,
    TASK_ACCEPTANCE: task.acceptance.map((item) => `- [ ] ${item}`).join('\n'),
    TASK_HINTS: task.hints?.map((item) => `- ${item}`).join('\n') ?? 'None',
    SPEC_CONVENTIONS: spec.conventions?.map((item) => `- ${item}`).join('\n') ?? 'Use existing conventions',
    WORKING_DIRECTORY: spec.working_directory ?? process.cwd(),
  })
}

const createSimulatedAgent = (task: Task): AgentProcess => {
  const outputCallbacks: Array<(line: string) => void> = []
  const wait = (): Promise<AgentResult> =>
    new Promise((resolve) => {
      setTimeout(() => {
        outputCallbacks.forEach((cb) => cb(`[simulated] ${task.title} finished.`))
        resolve({ success: true, result: '<promise>COMPLETE</promise>' })
      }, 400)
    })

  return {
    pid: 0,
    onOutput: (cb) => outputCallbacks.push(cb),
    wait,
    kill: () => {},
  }
}

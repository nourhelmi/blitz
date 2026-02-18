import { spawn } from 'child_process'
import { createInterface } from 'readline'
import { readFile } from 'fs/promises'
import type { Spec, Task, State } from './schema'
import { loadPrompt, renderPrompt } from './llm/prompts'
import { getContextPath } from './paths'

export type AgentResult = {
  success: boolean
  result?: string
  context?: string
  error?: string
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

export type SpawnAgentOptions = {
  task: Task
  spec: Spec
  state?: State
  allTasks?: Task[]
  timeoutMs?: number
}

export const spawnAgent = async (options: SpawnAgentOptions): Promise<AgentProcess> => {
  if (process.env.BLITZ_DRY_RUN === 'true') return createSimulatedAgent(options.task)
  return spawnClaudeCode(options)
}

const spawnClaudeCode = async (options: SpawnAgentOptions): Promise<AgentProcess> => {
  const { task, spec, state, allTasks, timeoutMs } = options
  const prompt = await buildSessionPrompt(task, spec, state, allTasks)
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
  const stderrLines: string[] = []

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
  stderr.on('line', (line) => {
    stderrLines.push(line)
    if (stderrLines.length > 50) stderrLines.shift()
    outputCallbacks.forEach((cb) => cb(`[stderr] ${line}`))
  })

  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined

  return {
    pid: proc.pid ?? 0,
    onOutput: (cb) => outputCallbacks.push(cb),
    wait: () =>
      new Promise((resolve) => {
        if (timeoutMs && timeoutMs > 0) {
          timer = setTimeout(() => {
            timedOut = true
            proc.kill()
          }, timeoutMs)
        }
        proc.on('exit', (code) => {
          if (timer) clearTimeout(timer)
          if (timedOut) {
            resolve({
              success: false,
              error: `Agent timed out after ${Math.round((timeoutMs ?? 0) / 60000)}m`,
            })
            return
          }
          const success =
            code === 0 || Boolean(finalResult?.includes('<promise>COMPLETE</promise>'))
          const contextMatch = fullOutput.match(
            /<blitz-context>([\s\S]*?)<\/blitz-context>/i
          )
          const errorDetail = !success
            ? extractErrorFromOutput(stderrLines, fullOutput)
            : undefined
          resolve({
            success,
            result: finalResult,
            context: contextMatch ? contextMatch[1]?.trim() : undefined,
            error: errorDetail,
          })
        })
      }),
    kill: () => proc.kill(),
  }
}

const extractErrorFromOutput = (stderrLines: string[], fullOutput: string): string => {
  // Look for common error patterns in stderr first
  const errorPatterns = /(?:Error:|FATAL:|Permission denied|ENOENT|EACCES|SyntaxError|TypeError|ReferenceError)/i
  const stderrError = stderrLines.filter((l) => errorPatterns.test(l)).slice(-5)
  if (stderrError.length > 0) return stderrError.join('\n')

  // Fall back to last N lines of stderr
  if (stderrLines.length > 0) return stderrLines.slice(-10).join('\n')

  // Fall back to last N lines of output
  const outputLines = fullOutput.split('\n').slice(-10)
  return outputLines.join('\n') || 'Agent exited with no error message.'
}

const buildSessionPrompt = async (
  task: Task,
  spec: Spec,
  state?: State,
  allTasks?: Task[]
): Promise<string> => {
  if (!sessionTemplate) {
    sessionTemplate = await loadPrompt('session.md')
  }

  // Build tech stack summary
  const techStack = spec.architecture?.tech_stack
    ?.map((entry) => `- **${entry.category}**: ${entry.items.join(', ')}`)
    .join('\n') ?? 'Not specified'

  // Build related tasks (dependencies and their statuses)
  let relatedTasks = 'None'
  if (task.blocked_by.length > 0 && allTasks && state) {
    relatedTasks = task.blocked_by
      .map((depId) => {
        const dep = allTasks.find((t) => t.id === depId)
        const depStatus = state.task_states[depId] ?? 'pending'
        return dep ? `- [${depStatus}] ${dep.id}: ${dep.title}` : `- [${depStatus}] ${depId}`
      })
      .join('\n')
  }

  // Build files likely touched
  const filesLikelyTouched = task.files_likely_touched?.length
    ? task.files_likely_touched.map((f) => `- ${f}`).join('\n')
    : 'Not specified'

  // Read recent context from blitz-context.md (filtered to dependency tasks)
  let recentContext = 'No prior context available.'
  try {
    const contextContent = await readFile(getContextPath(), 'utf-8')
    if (task.blocked_by.length > 0) {
      // Extract sections for dependency tasks only
      const sections = task.blocked_by
        .map((depId) => {
          const pattern = new RegExp(
            `## Task ${depId}[:\\s][\\s\\S]*?(?=## Task |$)`,
            'i'
          )
          const match = contextContent.match(pattern)
          return match ? match[0].trim() : null
        })
        .filter(Boolean)
      recentContext = sections.length > 0
        ? sections.join('\n\n')
        : 'No context from dependency tasks yet.'
    } else {
      // For tasks with no deps, include last 30 lines of context
      const lines = contextContent.split('\n')
      recentContext = lines.slice(-30).join('\n').trim() || 'No prior context available.'
    }
  } catch {
    // Context file may not exist yet
  }

  return renderPrompt(sessionTemplate, {
    TASK_ID: task.id,
    TASK_TITLE: task.title,
    TASK_DESCRIPTION: task.description,
    TASK_ACCEPTANCE: task.acceptance.map((item) => `- [ ] ${item}`).join('\n'),
    TASK_HINTS: task.hints?.map((item) => `- ${item}`).join('\n') ?? 'None',
    SPEC_SUMMARY: spec.summary ?? 'No summary available.',
    SPEC_GOALS: spec.goals?.map((g) => `- ${g}`).join('\n') ?? 'None specified',
    SPEC_ARCHITECTURE: spec.architecture?.overview ?? 'Not specified',
    SPEC_TECH_STACK: techStack,
    SPEC_CONSTRAINTS: spec.constraints?.map((c) => `- ${c}`).join('\n') ?? 'None specified',
    SPEC_CONVENTIONS: spec.conventions?.map((item) => `- ${item}`).join('\n') ?? 'Use existing conventions',
    FILES_LIKELY_TOUCHED: filesLikelyTouched,
    RELATED_TASKS: relatedTasks,
    RECENT_CONTEXT: recentContext,
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

import type { AgentProcess } from './worker'

type RunControl = {
  runId?: string
  paused: boolean
  stopping: boolean
  activeWorkers: Map<string, AgentProcess>
  resumeResolvers: Array<() => void>
}

const getControl = (): RunControl => {
  if (!globalThis.__blitzRunControl) {
    globalThis.__blitzRunControl = {
      paused: false,
      stopping: false,
      activeWorkers: new Map<string, AgentProcess>(),
      resumeResolvers: [],
    }
  }
  return globalThis.__blitzRunControl
}

export const initRunControl = (runId: string): RunControl => {
  const control = getControl()
  control.runId = runId
  control.paused = false
  control.stopping = false
  control.activeWorkers.clear()
  control.resumeResolvers = []
  return control
}

export const getRunControl = (): RunControl => getControl()

export const pauseRun = (): void => {
  const control = getControl()
  control.paused = true
}

export const resumeRun = (): void => {
  const control = getControl()
  control.paused = false
  control.resumeResolvers.forEach((resolve) => resolve())
  control.resumeResolvers = []
}

export const stopRun = (): void => {
  const control = getControl()
  control.stopping = true
  control.activeWorkers.forEach((worker) => worker.kill())
}

export const waitForResume = (control: RunControl): Promise<void> => {
  if (!control.paused) return Promise.resolve()
  return new Promise((resolve) => {
    control.resumeResolvers.push(resolve)
  })
}

declare global {
  // eslint-disable-next-line no-var
  var __blitzRunControl: RunControl | undefined
}

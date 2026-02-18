import type { PipelineStage } from './schema'
import { nowIso } from './time'

export type BlitzEvent =
  | { type: 'stage_change'; stage: PipelineStage }
  | { type: 'spec_ready'; spec_id: string }
  | { type: 'tasks_ready'; count: number }
  | { type: 'task_started'; task_id: string }
  | { type: 'task_log'; task_id: string; line: string }
  | { type: 'task_completed'; task_id: string; success: boolean; error?: string }
  | { type: 'run_started'; run_id: string }
  | { type: 'run_completed'; success: boolean }
  | { type: 'run_init'; success: boolean; error?: string }
  | { type: 'clarifications_ready'; count: number }

type StreamController = ReadableStreamDefaultController<Uint8Array>

type EventHub = {
  subscribers: Set<StreamController>
}

// In-memory event hub for SSE in the Node runtime.
const getHub = (): EventHub => {
  if (!globalThis.__blitzEventHub) {
    globalThis.__blitzEventHub = { subscribers: new Set<StreamController>() }
  }
  return globalThis.__blitzEventHub
}

export const createEventStream = (): ReadableStream<Uint8Array> => {
  const hub = getHub()
  let streamController: StreamController | undefined
  let heartbeat: ReturnType<typeof setInterval> | undefined
  return new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller
      hub.subscribers.add(controller)
      controller.enqueue(encodeEvent({ type: 'stage_change', stage: 'empty' }))
      heartbeat = setInterval(() => {
        controller.enqueue(encodeComment('heartbeat'))
      }, 20000)
    },
    cancel() {
      if (streamController) hub.subscribers.delete(streamController)
      if (heartbeat) clearInterval(heartbeat)
    },
  })
}

export const emitEvent = (event: BlitzEvent): void => {
  const hub = getHub()
  const payload = encodeEvent({ ...event, at: nowIso() })
  hub.subscribers.forEach((controller) => controller.enqueue(payload))
}

const encodeEvent = (event: BlitzEvent & { at?: string }): Uint8Array => {
  const data = JSON.stringify(event)
  return new TextEncoder().encode(`data: ${data}\n\n`)
}

const encodeComment = (value: string): Uint8Array =>
  new TextEncoder().encode(`: ${value}\n\n`)

declare global {
  // eslint-disable-next-line no-var
  var __blitzEventHub: EventHub | undefined
}

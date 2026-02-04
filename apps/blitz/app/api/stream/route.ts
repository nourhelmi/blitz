import { createEventStream } from '@/lib/events'
import { logInfo } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = async (): Promise<Response> => {
  await logInfo('stream.connect')
  return new Response(createEventStream(), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

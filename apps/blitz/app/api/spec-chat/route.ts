import { streamText, convertToModelMessages, type UIMessage, tool, stepCountIs } from 'ai'
import { openrouter } from '@openrouter/ai-sdk-provider'
import { z } from 'zod'
import { Bash } from 'just-bash'
import { getSpec, saveSpec } from '@/lib/spec'
import { SpecSchema } from '@/lib/schema'
import { getModelId } from '@/lib/llm/client'
import { loadPrompt } from '@/lib/llm/prompts'
import { emitEvent } from '@/lib/events'
import { updateState } from '@/lib/state'
import { getSpecPath } from '@/lib/paths'
import { logInfo } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const POST = async (req: Request): Promise<Response> => {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const spec = await getSpec()
  if (!spec) {
    return new Response('No spec exists yet.', { status: 404 })
  }

  const specJson = JSON.stringify(spec, null, 2)

  // Sandboxed in-memory bash with the spec mounted as a file.
  // Agent uses jq/sed/etc. to make surgical edits — no custom merge logic needed.
  const bash = new Bash({
    files: { '/spec.json': specJson },
  })

  // Track the last valid spec state for change detection + rollback
  let lastKnownSpec = specJson

  const systemPrompt = await loadPrompt('spec-chat.md')

  const result = streamText({
    model: openrouter(getModelId()),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: {
      bash: tool({
        description:
          'Execute bash commands in a sandboxed environment. ' +
          'The project spec lives at /spec.json. ' +
          'Use jq for JSON reads and writes. ' +
          'After writing, the spec is validated automatically — invalid edits are reverted.',
        inputSchema: z.object({
          command: z.string().describe('Bash command to execute.'),
        }),
        execute: async ({ command }) => {
          const result = await bash.exec(command)

          // Read spec back to detect changes
          const read = await bash.exec('cat /spec.json')
          const currentJson = read.stdout.trim()
          let specUpdated = false

          if (currentJson && currentJson !== lastKnownSpec) {
            try {
              const parsed = SpecSchema.parse(JSON.parse(currentJson))

              // Valid — persist to disk, update pipeline, emit SSE
              await saveSpec({ ...parsed, approved_at: undefined })
              await updateState((state) => ({
                ...state,
                pipeline: {
                  ...state.pipeline,
                  stage: 'spec_review',
                  spec_path: getSpecPath(),
                  error: undefined,
                },
              }))
              emitEvent({ type: 'spec_ready', spec_id: parsed.id })
              lastKnownSpec = currentJson
              specUpdated = true
              await logInfo('spec-chat.bash.updated', { command })
            } catch (err) {
              // Invalid spec — roll back the sandbox to the last valid state
              await bash.exec(
                `cat <<'__REVERT__' > /spec.json\n${lastKnownSpec}\n__REVERT__`
              )
              return {
                stdout: result.stdout,
                stderr: `Spec validation failed: ${err instanceof Error ? err.message : 'unknown'}. Edit reverted.`,
                exitCode: 1,
                spec_updated: false,
              }
            }
          }

          return {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            spec_updated: specUpdated,
          }
        },
      }),
    },
    // More headroom than before — bash interactions tend to be read-then-write
    stopWhen: stepCountIs(6),
  })

  return result.toUIMessageStreamResponse()
}

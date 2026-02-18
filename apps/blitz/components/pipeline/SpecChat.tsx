'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useState, useRef, useEffect, useMemo } from 'react'
import { cx } from '@/lib/cx'

// Shared transport instance — avoids re-creating on every render
const transport = new DefaultChatTransport({ api: '/api/spec-chat' })

type SpecChatProps = {
  /** Called after AI finishes a response (for manual refresh if SSE misses) */
  onRefresh?: () => void
}

export const SpecChat = ({ onRefresh }: SpecChatProps) => {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { messages, sendMessage, status, stop } = useChat({
    transport,
    onFinish: () => {
      // Belt-and-suspenders: trigger refresh after AI response completes.
      // SSE should already handle this, but this catches edge cases.
      onRefresh?.()
    },
  })

  const isStreaming = status === 'streaming' || status === 'submitted'

  // Auto-scroll when new content arrives
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, status])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isStreaming) return
    sendMessage({ text })
    setInput('')
  }

  // Pre-compute whether there are any messages to show the empty state
  const hasMessages = messages.length > 0

  return (
    <div className="flex h-full flex-col rounded-(--radius) border border-white/5 bg-[rgba(10,14,22,0.9)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <div className="relative flex h-2 w-2">
          <span
            className={cx(
              'absolute inline-flex h-full w-full rounded-full',
              isStreaming
                ? 'animate-ping bg-(--accent) opacity-75'
                : 'bg-(--accent) opacity-40'
            )}
          />
          <span
            className={cx(
              'relative inline-flex h-2 w-2 rounded-full',
              isStreaming ? 'bg-(--accent)' : 'bg-(--accent) opacity-60'
            )}
          />
        </div>
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-(--muted)">
          Spec Architect
        </span>
        {isStreaming && (
          <button
            onClick={() => stop()}
            className="ml-auto font-mono text-[10px] uppercase tracking-wider text-(--danger) hover:text-white transition-colors"
          >
            Stop
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="spec-chat-scroll flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {!hasMessages && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-2 py-12">
              <p className="font-mono text-xs text-(--muted) opacity-60">
                Modify the spec through conversation.
              </p>
              <p className="font-mono text-[10px] text-(--muted) opacity-40">
                &ldquo;Add a caching layer&rdquo; &bull; &ldquo;Split phase-2 into two phases&rdquo; &bull; &ldquo;Tighten the constraints&rdquo;
              </p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {/* Streaming indicator */}
        {status === 'submitted' && (
          <div className="flex items-center gap-2 py-1">
            <StreamingDots />
            <span className="font-mono text-[10px] text-(--muted) opacity-50">
              thinking…
            </span>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-white/5 p-3">
        <div className="relative">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isStreaming}
            placeholder="Describe spec changes…"
            className="h-10 w-full rounded-xl border border-white/8 bg-(--surface) px-4 pr-16 font-mono text-xs text-white placeholder:text-(--muted) placeholder:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--ring) disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-(--accent) px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-black transition-all hover:bg-[#c9ff5a] disabled:opacity-30 disabled:hover:bg-(--accent)"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat Message
// ─────────────────────────────────────────────────────────────────────────────

type ChatMessageProps = {
  message: {
    id: string
    role: string
    parts: Array<{
      type: string
      text?: string
      toolName?: string
      state?: string
      input?: unknown
      output?: unknown
    }>
  }
}

const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.role === 'user'

  // Collect renderable parts
  const rendered = useMemo(
    () =>
      message.parts.map((part, i) => {
        if (part.type === 'text' && part.text) {
          return (
            <span key={i} className="whitespace-pre-wrap wrap-break-word">
              {part.text}
            </span>
          )
        }

        // Bash tool calls — show command + result inline
        if (part.type.startsWith('tool-') && part.toolName === 'bash') {
          const inp = (typeof part.input === 'object' && part.input !== null ? part.input : {}) as Record<string, unknown>
          return <BashCallBlock key={i} state={part.state} input={inp} output={part.output} />
        }

        return null
      }),
    [message.parts]
  )

  return (
    <div className={cx('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cx(
          'max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed',
          isUser
            ? 'bg-(--accent)/12 text-white border border-(--accent)/20'
            : 'bg-white/4 text-(--muted) border border-white/5'
        )}
      >
        {isUser ? (
          <div className="font-sans">{rendered}</div>
        ) : (
          <div className="font-mono space-y-2">{rendered}</div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Bash Call Block — renders a bash tool invocation with command + output
// ─────────────────────────────────────────────────────────────────────────────

type BashResult = { stdout?: string; stderr?: string; exitCode?: number; spec_updated?: boolean }

type BashCallBlockProps = {
  state?: string
  input?: Record<string, unknown>
  output?: unknown
}

const BashCallBlock = ({ state, input, output }: BashCallBlockProps) => {
  const isComplete = state === 'output-available'
  const command = (input?.command as string) ?? ''
  const result = output as BashResult | undefined
  const specUpdated = result?.spec_updated === true
  const failed = isComplete && (result?.exitCode ?? 0) !== 0

  return (
    <div className="my-1.5 rounded-lg border border-white/8 bg-[rgba(6,8,14,0.8)] overflow-hidden">
      {/* Command line */}
      {command && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 bg-white/3">
          <span className="text-[10px] text-(--accent-3) select-none">$</span>
          <code className="text-[10px] text-(--muted) truncate">{command}</code>
        </div>
      )}

      {/* Result */}
      <div className="px-3 py-1.5">
        {!isComplete ? (
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-(--accent-3) animate-pulse" />
            <span className="text-[10px] text-(--accent-3)">running…</span>
          </div>
        ) : (
          <div className="space-y-1">
            {/* stdout (truncated) */}
            {result?.stdout && (
              <pre className="text-[10px] text-(--muted) whitespace-pre-wrap max-h-20 overflow-hidden">
                {result.stdout.length > 300 ? `${result.stdout.slice(0, 300)}…` : result.stdout}
              </pre>
            )}

            {/* stderr on failure */}
            {failed && result?.stderr && (
              <pre className="text-[10px] text-(--danger) whitespace-pre-wrap">
                {result.stderr.length > 200 ? `${result.stderr.slice(0, 200)}…` : result.stderr}
              </pre>
            )}

            {/* Spec updated indicator */}
            {specUpdated && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-(--accent)" />
                <span className="text-[10px] uppercase tracking-wider text-(--accent)">spec updated</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Streaming Dots — three-dot loader
// ─────────────────────────────────────────────────────────────────────────────

const StreamingDots = () => (
  <div className="flex gap-1">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="h-1 w-1 rounded-full bg-(--accent)"
        style={{
          opacity: 0.4,
          animation: `spec-badge-pulse 1s ease-in-out ${i * 0.15}s infinite`,
        }}
      />
    ))}
  </div>
)

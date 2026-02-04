import { APICallError } from 'ai'

type ErrorMeta = Record<string, string | number | boolean | undefined>

// Normalize provider errors into safe loggable metadata.
export const getLlmErrorMeta = (error: unknown): ErrorMeta => {
  if (APICallError.isInstance(error)) {
    return {
      url: error.url,
      statusCode: error.statusCode,
      isRetryable: error.isRetryable,
      responseBody: truncate(error.responseBody),
      responseHeaders: error.responseHeaders ? truncate(safeJson(error.responseHeaders)) : undefined,
      data: error.data ? truncate(safeJson(error.data)) : undefined,
    }
  }

  if (error instanceof Error) {
    return { message: error.message }
  }

  return { message: typeof error === 'string' ? error : safeJson(error) }
}

const safeJson = (value: unknown): string => {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const truncate = (value?: string, limit = 1200): string | undefined => {
  if (!value) return undefined
  const trimmed = value.trim()
  if (trimmed.length <= limit) return trimmed
  return `${trimmed.slice(0, limit)}…`
}

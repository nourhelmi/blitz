export const nowIso = (): string => new Date().toISOString()

export const formatIso = (value: string | undefined): string =>
  value ? new Date(value).toLocaleString() : '—'

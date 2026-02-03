import type { ComponentPropsWithoutRef } from 'react'
import { cx } from '@/lib/cx'

type TextareaProps = ComponentPropsWithoutRef<'textarea'>

export const Textarea = ({ className, ...props }: TextareaProps) => (
  <textarea
    className={cx(
      'min-h-[140px] w-full rounded-[14px] border border-white/10 bg-[var(--surface-2)] px-4 py-3 text-sm text-white placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
      className
    )}
    {...props}
  />
)

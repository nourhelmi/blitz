import type { ComponentPropsWithoutRef } from 'react'
import { cx } from '@/lib/cx'

type InputProps = ComponentPropsWithoutRef<'input'>

export const Input = ({ className, ...props }: InputProps) => (
  <input
    className={cx(
      'h-11 w-full rounded-[14px] border border-white/10 bg-[var(--surface-2)] px-4 text-sm text-white placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
      className
    )}
    {...props}
  />
)

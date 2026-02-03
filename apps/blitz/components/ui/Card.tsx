import type { ComponentPropsWithoutRef } from 'react'
import { cx } from '@/lib/cx'

type CardProps = ComponentPropsWithoutRef<'div'> & {
  glow?: boolean
}

export const Card = ({ className, glow = false, ...props }: CardProps) => (
  <div
    className={cx(
      'rounded-[var(--radius)] border border-white/5 bg-[rgba(18,25,39,0.8)] p-6 shadow-[var(--shadow)]',
      glow ? 'glow' : '',
      className
    )}
    {...props}
  />
)

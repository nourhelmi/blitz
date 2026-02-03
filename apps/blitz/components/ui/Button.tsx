import type { ComponentPropsWithoutRef } from 'react'
import { cx } from '@/lib/cx'

type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantStyles: Record<ButtonVariant, string> = {
  solid:
    'bg-[var(--accent)] text-black shadow-[0_0_24px_rgba(183,255,42,0.4)] hover:bg-[#c9ff5a]',
  outline:
    'border border-[var(--border)] bg-transparent text-[var(--ink)] hover:border-[var(--accent)] hover:text-white',
  ghost: 'bg-transparent text-[var(--muted)] hover:text-white',
  danger:
    'bg-[var(--danger)] text-black shadow-[0_0_24px_rgba(255,95,122,0.35)] hover:bg-[#ff7890]',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-xs tracking-[0.06em]',
  md: 'h-11 px-5 text-sm tracking-[0.08em]',
}

export const Button = ({
  className,
  variant = 'solid',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) => (
  <button
    className={cx(
      'inline-flex items-center justify-center rounded-[var(--radius)] font-medium uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60',
      variantStyles[variant],
      sizeStyles[size],
      className
    )}
    type={type}
    {...props}
  />
)

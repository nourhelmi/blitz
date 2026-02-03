import Link from 'next/link'
import { cx } from '@/lib/cx'

const navItems = [
  { href: '/', label: 'Pipeline' },
  { href: '/spec', label: 'Spec Review' },
  { href: '/tasks', label: 'Task Review' },
  { href: '/graph', label: 'Dependency Graph' },
  { href: '/runs', label: 'Runs' },
]

export const TopNav = () => (
  <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(10,13,18,0.75)] backdrop-blur">
    <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-3)] text-[var(--accent)] shadow-[0_0_20px_rgba(183,255,42,0.3)]">
          <span className="font-semibold text-lg tracking-[0.12em]">B</span>
        </div>
        <div>
          <p className="font-semibold text-xl uppercase tracking-[0.08em] text-white">
            Blitz
          </p>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Orchestrator</p>
        </div>
      </div>
      <nav className="hidden items-center gap-6 text-sm uppercase tracking-[0.06em] text-[var(--muted)] md:flex">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              'transition-colors hover:text-white',
              item.href === '/' ? 'text-white' : ''
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  </header>
)

import type { ReactNode } from 'react'
import { TopNav } from './TopNav'

export const AppShell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen">
    <TopNav />
    <main className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-10 sm:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 grid-surface opacity-40" />
      <div className="relative">{children}</div>
    </main>
  </div>
)

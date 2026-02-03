import { cx } from '@/lib/cx'
import type { TaskStatus } from '@/lib/schema'

const statusStyles: Record<TaskStatus, string> = {
  pending: 'bg-white/10 text-[var(--muted)]',
  blocked: 'bg-[#2c2435] text-[#f7b955]',
  ready: 'bg-[#162a1c] text-[#8dff9e]',
  in_progress: 'bg-[#1b2636] text-[#5ad2ff]',
  completed: 'bg-[#1b2e22] text-[#7dff9c]',
  failed: 'bg-[#351f25] text-[#ff7a90]',
}

export const StatusBadge = ({ status }: { status: TaskStatus }) => (
  <span
    className={cx(
      'inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
      statusStyles[status]
    )}
  >
    {status.replace('_', ' ')}
  </span>
)

import type { ReactNode } from 'react'

interface WarningBarProps {
  children: ReactNode
}

export function WarningBar({ children }: WarningBarProps): JSX.Element {
  return (
    <div className="mb-6 rounded-md border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-100">
      {children}
    </div>
  )
}

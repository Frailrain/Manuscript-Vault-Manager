import type { ReactNode } from 'react'

interface FieldGroupProps {
  label: string
  helpText?: ReactNode
  children: ReactNode
}

export function FieldGroup({
  label,
  helpText,
  children
}: FieldGroupProps): JSX.Element {
  return (
    <div className="mb-6">
      <label className="mb-2 block text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {label}
      </label>
      {children}
      {helpText ? (
        <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
          {helpText}
        </p>
      ) : null}
    </div>
  )
}

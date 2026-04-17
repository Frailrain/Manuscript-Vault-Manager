import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface SecondaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}

export function SecondaryButton({
  children,
  className = '',
  ...rest
}: SecondaryButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={`rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

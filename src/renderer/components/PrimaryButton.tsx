import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}

export function PrimaryButton({
  children,
  className = '',
  ...rest
}: PrimaryButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={`rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

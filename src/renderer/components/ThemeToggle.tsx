import { Moon, Sun } from 'lucide-react'

interface ThemeToggleProps {
  theme: 'light' | 'dark'
  onToggle: () => void
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps): JSX.Element {
  const Icon = theme === 'dark' ? Sun : Moon
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className="rounded-md p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
    >
      <Icon size={18} />
    </button>
  )
}

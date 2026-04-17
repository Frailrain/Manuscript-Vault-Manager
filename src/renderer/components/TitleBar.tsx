import { useAppStore } from '../stores/appStore'
import { ThemeToggle } from './ThemeToggle'

export function TitleBar(): JSX.Element {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  async function handleToggle(): Promise<void> {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      await window.mvm.settings.update({ theme: next })
    } catch {
      // Persistence failure is non-fatal; UI already updated.
    }
  }

  return (
    <div className="flex h-10 items-center justify-between border-b border-neutral-200 bg-white px-4 dark:border-neutral-700 dark:bg-neutral-900">
      <span className="text-base font-medium text-neutral-900 dark:text-neutral-100">
        Manuscript Vault Manager
      </span>
      <ThemeToggle theme={theme} onToggle={handleToggle} />
    </div>
  )
}

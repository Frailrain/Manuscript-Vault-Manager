import { useAppStore } from '../stores/appStore'

const TABS: Array<{ id: 'settings' | 'run'; label: string }> = [
  { id: 'settings', label: 'Settings' },
  { id: 'run', label: 'Run' }
]

export function TabBar(): JSX.Element {
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  return (
    <div className="flex h-10 items-stretch border-b border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 text-sm font-medium transition-colors ${
              isActive
                ? 'border-b-2 border-sky-600 text-neutral-900 dark:text-neutral-100'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

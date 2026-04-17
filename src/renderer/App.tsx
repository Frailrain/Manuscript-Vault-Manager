import { useEffect } from 'react'

import { RunTab } from './components/RunTab'
import { SettingsTab } from './components/SettingsTab'
import { TabBar } from './components/TabBar'
import { TitleBar } from './components/TitleBar'
import { useLoadSettingsOnMount } from './hooks/useLoadSettingsOnMount'
import { useProgressSubscription } from './hooks/useProgressSubscription'
import { useAppStore } from './stores/appStore'

export default function App(): JSX.Element {
  const theme = useAppStore((s) => s.theme)
  const activeTab = useAppStore((s) => s.activeTab)

  useLoadSettingsOnMount()
  useProgressSubscription()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="flex h-screen w-screen flex-col bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <TitleBar />
      <TabBar />
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'settings' ? <SettingsTab /> : <RunTab />}
      </div>
    </div>
  )
}

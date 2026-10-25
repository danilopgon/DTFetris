import DesignList from './components/DesignList/DesignList'
import MetricsPanel from './components/MetricsPanel/MetricsPanel'
import SheetPreview from './components/SheetPreview/SheetPreview'
import JobToolbar from './components/JobToolbar/JobToolbar'
import { useState } from 'react'
import { useAppStore } from './store/useAppStore'

export default function App() {
  const [busy, setBusy] = useState(false)
  const optimizing = useAppStore((s) => s.isOptimizing)
  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <aside className="w-80 shrink-0 overflow-y-auto border-r border-gray-700 p-4">
        <fieldset disabled={busy || optimizing}>
          <DesignList />
        </fieldset>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <JobToolbar onBusyChange={setBusy} />
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <SheetPreview />
        </div>
        <footer className="max-h-48 overflow-auto border-t border-gray-700 p-4">
          <MetricsPanel />
        </footer>
      </main>
    </div>
  )
}

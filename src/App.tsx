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
    <div className="shell">
      {/* JobToolbar fills the top bar and the sheet header cells of the grid. */}
      <JobToolbar onBusyChange={setBusy} />
      <aside className="shell-side p-4">
        <fieldset disabled={busy || optimizing}>
          <DesignList />
        </fieldset>
      </aside>
      <main className="shell-stage p-6">
        <SheetPreview />
      </main>
      <aside className="shell-metrics px-4 py-6">
        <MetricsPanel />
      </aside>
    </div>
  )
}

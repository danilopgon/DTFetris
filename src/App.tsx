import DesignList from './components/DesignList/DesignList'
import MetricsPanel from './components/MetricsPanel/MetricsPanel'
import SheetPreview from './components/SheetPreview/SheetPreview'

export default function App() {
  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <aside className="w-64 border-r border-gray-700 p-4">
        <DesignList />
      </aside>
      <main className="flex flex-1 flex-col">
        <div className="flex-1 p-4">
          <SheetPreview />
        </div>
        <footer className="border-t border-gray-700 p-4">
          <MetricsPanel />
        </footer>
      </main>
    </div>
  )
}

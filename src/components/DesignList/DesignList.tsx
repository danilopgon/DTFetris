import { useAppStore } from '../../store/useAppStore'

export default function DesignList() {
  const designs = useAppStore((state) => state.designs)

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Diseños</h2>
      {designs.length === 0 ? (
        <p className="text-sm text-gray-400">Aún no hay diseños.</p>
      ) : (
        <ul className="space-y-2">
          {designs.map((d) => (
            <li key={d.id} className="rounded bg-gray-800 p-2 text-sm">
              {d.name} ({d.widthCm} × {d.heightCm} cm) ×{d.quantity}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

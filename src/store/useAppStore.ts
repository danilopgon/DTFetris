import { create } from 'zustand'
import { importDesign as importDesignCommand, runPacking } from '../commands'
import {
  DEFAULT_SHEET_CONFIG,
  validateEditableDesignInput,
  validatePackingRequest,
  isPositiveIntegerCm,
  type DesignInput,
  type DesignUpdatePatch,
  type DomainValidationError,
  type ImportDesignRequest,
  type Sheet,
  type SheetConfig,
  type UnplacedItem,
  type Job,
} from '../types/domain'

type DesignMutationResult = { ok: true } | { ok: false; errors: DomainValidationError[] }

type AppState = {
  designs: DesignInput[]
  sheets: Sheet[]
  unplacedItems: UnplacedItem[]
  sheetConfig: SheetConfig
  sheetWidthCm: number
  sheetHeightCm: number
  isOptimizing: boolean
  isImporting: boolean
  jobRevision: number
  isLayoutStale: boolean
  addDesign: (design: DesignInput) => void
  updateDesign: (id: string, patch: DesignUpdatePatch) => DesignMutationResult
  duplicateDesign: (id: string) => DesignInput | null
  removeDesign: (id: string) => void
  importDesign: (request: ImportDesignRequest) => Promise<DesignInput>
  setSheets: (sheets: Sheet[]) => void
  setSheetSize: (widthCm: number, heightCm: number) => void
  setOptimizing: (value: boolean) => void
  generateSheets: () => Promise<void>
  restoreJob: (job: Job) => void
}

export const useAppStore = create<AppState>((set) => ({
  designs: [],
  sheets: [],
  unplacedItems: [],
  sheetConfig: DEFAULT_SHEET_CONFIG,
  sheetWidthCm: DEFAULT_SHEET_CONFIG.widthCm,
  sheetHeightCm: DEFAULT_SHEET_CONFIG.heightCm,
  isOptimizing: false,
  isImporting: false,
  jobRevision: 0,
  isLayoutStale: false,
  addDesign: (design) =>
    set((state) => ({ designs: [...state.designs, design], ...pendingLayout })),
  updateDesign: (id, patch) => {
    const currentDesign = useAppStore.getState().designs.find((design) => design.id === id)
    if (!currentDesign) return { ok: false, errors: [] }

    const updatedDesign = { ...currentDesign, ...patch }
    const errors = validateEditableDesignInput(updatedDesign)
    if (errors.length > 0) return { ok: false, errors }

    set((state) => ({
      designs: state.designs.map((design) => (design.id === id ? updatedDesign : design)),
      sheets: [],
      isLayoutStale: true,
      unplacedItems: [],
    }))
    return { ok: true }
  },
  duplicateDesign: (id) => {
    const currentDesign = useAppStore.getState().designs.find((design) => design.id === id)
    if (!currentDesign) return null

    const duplicate: DesignInput = {
      ...currentDesign,
      id: createDesignId(),
      name: `${currentDesign.name} copia`,
    }

    set((state) => ({
      designs: [...state.designs, duplicate],
      sheets: [],
      isLayoutStale: true,
      unplacedItems: [],
    }))
    return duplicate
  },
  removeDesign: (id) =>
    set((state) => {
      const hasDesign = state.designs.some((design) => design.id === id)

      return {
        designs: state.designs.filter((design) => design.id !== id),
        sheets: hasDesign ? [] : state.sheets,
        isLayoutStale: hasDesign ? true : state.isLayoutStale,
        unplacedItems: hasDesign ? [] : state.unplacedItems,
      }
    }),
  importDesign: async (request) => {
    const revision = useAppStore.getState().jobRevision
    set({ isImporting: true })
    try {
      const design = await importDesignCommand(request)
      if (useAppStore.getState().jobRevision !== revision)
        throw new Error('El trabajo cambió durante la importación. Vuelve a seleccionar el diseño.')
      set((state) => ({ designs: [...state.designs, design], ...pendingLayout }))
      return design
    } finally {
      set({ isImporting: false })
    }
  },
  setSheets: (sheets) => set({ sheets, unplacedItems: [], isLayoutStale: false }),
  setSheetSize: (widthCm, heightCm) => {
    if (!isPositiveIntegerCm(widthCm) || !isPositiveIntegerCm(heightCm)) return
    const current = useAppStore.getState().sheetConfig
    if (current.widthCm === widthCm && current.heightCm === heightCm) return
    set({
      sheetConfig: { widthCm, heightCm },
      sheetWidthCm: widthCm,
      sheetHeightCm: heightCm,
      ...pendingLayout,
    })
  },
  setOptimizing: (value) => set({ isOptimizing: value }),
  generateSheets: async () => {
    const { designs, sheetConfig, isOptimizing } = useAppStore.getState()
    if (isOptimizing) return
    const request = { sheet: sheetConfig, designs }
    if (validatePackingRequest(request).length)
      throw new Error('Revisa las dimensiones y cantidades; importa al menos un diseño.')
    set({ isOptimizing: true })
    try {
      const result = await runPacking(request)
      const current = useAppStore.getState()
      if (current.designs === designs && current.sheetConfig === sheetConfig) {
        set({ ...result, isLayoutStale: false })
      }
    } finally {
      set({ isOptimizing: false })
    }
  },
  restoreJob: (job) =>
    set((state) => ({
      designs: job.designs,
      sheetConfig: job.sheetConfig,
      sheetWidthCm: job.sheetConfig.widthCm,
      sheetHeightCm: job.sheetConfig.heightCm,
      jobRevision: state.jobRevision + 1,
      ...pendingLayout,
    })),
}))

const pendingLayout = {
  sheets: [] as Sheet[],
  unplacedItems: [] as UnplacedItem[],
  isLayoutStale: true,
}

function createDesignId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `design-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

import { create } from 'zustand'
import { importDesign as importDesignCommand } from '../commands'
import {
  DEFAULT_SHEET_CONFIG,
  validateEditableDesignInput,
  type DesignInput,
  type DesignUpdatePatch,
  type DomainValidationError,
  type ImportDesignRequest,
  type Sheet,
  type SheetConfig,
} from '../types/domain'

type DesignMutationResult = { ok: true } | { ok: false; errors: DomainValidationError[] }

type AppState = {
  designs: DesignInput[]
  sheets: Sheet[]
  sheetConfig: SheetConfig
  sheetWidthCm: number
  sheetHeightCm: number
  isOptimizing: boolean
  isLayoutStale: boolean
  addDesign: (design: DesignInput) => void
  updateDesign: (id: string, patch: DesignUpdatePatch) => DesignMutationResult
  duplicateDesign: (id: string) => DesignInput | null
  removeDesign: (id: string) => void
  importDesign: (request: ImportDesignRequest) => Promise<DesignInput>
  setSheets: (sheets: Sheet[]) => void
  setSheetSize: (widthCm: number, heightCm: number) => void
  setOptimizing: (value: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  designs: [],
  sheets: [],
  sheetConfig: DEFAULT_SHEET_CONFIG,
  sheetWidthCm: DEFAULT_SHEET_CONFIG.widthCm,
  sheetHeightCm: DEFAULT_SHEET_CONFIG.heightCm,
  isOptimizing: false,
  isLayoutStale: false,
  addDesign: (design) => set((state) => ({ designs: [...state.designs, design] })),
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
      }
    }),
  importDesign: async (request) => {
    const design = await importDesignCommand(request)
    set((state) => ({ designs: [...state.designs, design], isLayoutStale: true }))
    return design
  },
  setSheets: (sheets) => set({ sheets, isLayoutStale: false }),
  setSheetSize: (widthCm, heightCm) =>
    set({ sheetConfig: { widthCm, heightCm }, sheetWidthCm: widthCm, sheetHeightCm: heightCm }),
  setOptimizing: (value) => set({ isOptimizing: value }),
}))

function createDesignId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `design-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

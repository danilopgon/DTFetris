import { create } from 'zustand'
import { DEFAULT_SHEET_CONFIG, type DesignInput, type Sheet, type SheetConfig } from '../types/domain'

type AppState = {
  designs: DesignInput[]
  sheets: Sheet[]
  sheetConfig: SheetConfig
  sheetWidthCm: number
  sheetHeightCm: number
  isOptimizing: boolean
  addDesign: (design: DesignInput) => void
  removeDesign: (id: string) => void
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
  addDesign: (design) => set((state) => ({ designs: [...state.designs, design] })),
  removeDesign: (id) => set((state) => ({ designs: state.designs.filter((d) => d.id !== id) })),
  setSheets: (sheets) => set({ sheets }),
  setSheetSize: (widthCm, heightCm) =>
    set({ sheetConfig: { widthCm, heightCm }, sheetWidthCm: widthCm, sheetHeightCm: heightCm }),
  setOptimizing: (value) => set({ isOptimizing: value }),
}))

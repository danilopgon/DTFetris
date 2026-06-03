import { create } from 'zustand'
import type { DesignInput, Sheet } from '../types/domain'

type AppState = {
  designs: DesignInput[]
  sheets: Sheet[]
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
  sheetWidthCm: 60,
  sheetHeightCm: 100,
  isOptimizing: false,
  addDesign: (design) => set((state) => ({ designs: [...state.designs, design] })),
  removeDesign: (id) => set((state) => ({ designs: state.designs.filter((d) => d.id !== id) })),
  setSheets: (sheets) => set({ sheets }),
  setSheetSize: (widthCm, heightCm) => set({ sheetWidthCm: widthCm, sheetHeightCm: heightCm }),
  setOptimizing: (value) => set({ isOptimizing: value }),
}))

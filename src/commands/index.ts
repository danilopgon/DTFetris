import { invoke } from '@tauri-apps/api/core'
import type { DesignInput, Sheet } from '../types/domain'

export async function runPacking(
  designs: DesignInput[],
  sheetWidth: number,
  sheetHeight: number,
): Promise<Sheet[]> {
  return invoke('run_packing', { designs, sheetWidth, sheetHeight })
}

export async function exportPng(sheets: Sheet[], outputPath: string): Promise<void> {
  return invoke('export_png', { sheets, outputPath })
}

export async function saveJob(job: unknown, path: string): Promise<void> {
  return invoke('save_job', { job, path })
}

export async function loadJob(path: string): Promise<unknown> {
  return invoke('load_job', { path })
}

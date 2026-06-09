import { invoke } from '@tauri-apps/api/core'
import type { PackingRequest, PackingResult, Sheet } from '../types/domain'

export async function runPacking(request: PackingRequest): Promise<PackingResult> {
  return invoke('run_packing', { request })
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

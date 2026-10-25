import { invoke } from '@tauri-apps/api/core'
import type {
  DesignInput,
  ImportDesignRequest,
  Job,
  PackingRequest,
  PackingResult,
  Sheet,
} from '../types/domain'

export async function importDesign(request: ImportDesignRequest): Promise<DesignInput> {
  return invoke('import_design', request)
}

export async function runPacking(request: PackingRequest): Promise<PackingResult> {
  return invoke('run_packing', { request })
}

export async function exportPng(
  sheets: Sheet[],
  designs: DesignInput[],
  outputPath: string,
): Promise<string[]> {
  return invoke('export_png', { sheets, designs, outputPath })
}

export async function saveJob(job: Job, path: string): Promise<void> {
  return invoke('save_job', { job, path })
}

export async function loadJob(path: string): Promise<Job> {
  return invoke('load_job', { path })
}

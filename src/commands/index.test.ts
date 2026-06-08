import { invoke } from '@tauri-apps/api/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PackingRequest, PackingResult } from '../types/domain'
import { runPacking } from './index'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

const invokeMock = vi.mocked(invoke)

describe('runPacking command wrapper', () => {
  beforeEach(() => {
    invokeMock.mockReset()
  })

  it('invokes run_packing with the explicit packing request payload', async () => {
    const request: PackingRequest = {
      sheet: { widthCm: 55, heightCm: 100 },
      designs: [
        {
          id: 'design-1',
          name: 'Logo',
          imagePath: 'C:/assets/logo.png',
          widthCm: 12,
          heightCm: 8,
          originalAspectRatio: 1.5,
          quantity: 2,
          canRotate: true,
        },
      ],
    }
    const result: PackingResult = {
      sheets: [
        {
          id: 'sheet-1',
          widthCm: 55,
          heightCm: 100,
          placements: [],
        },
      ],
      unplacedItems: [],
    }
    invokeMock.mockResolvedValueOnce(result)

    await expect(runPacking(request)).resolves.toEqual(result)

    expect(invokeMock).toHaveBeenCalledWith('run_packing', { request })
  })

  it('returns unplaced items from the Rust packing result contract', async () => {
    const request: PackingRequest = {
      sheet: { widthCm: 20, heightCm: 20 },
      designs: [
        {
          id: 'oversized',
          name: 'Oversized',
          imagePath: 'C:/assets/oversized.png',
          widthCm: 30,
          heightCm: 30,
          originalAspectRatio: 1,
          quantity: 1,
          canRotate: false,
        },
      ],
    }
    const result: PackingResult = {
      sheets: [],
      unplacedItems: [{ designId: 'oversized', itemIndex: 0, reason: 'does_not_fit' }],
    }
    invokeMock.mockResolvedValueOnce(result)

    await expect(runPacking(request)).resolves.toEqual(result)

    expect(invokeMock).toHaveBeenCalledWith('run_packing', { request })
  })
})

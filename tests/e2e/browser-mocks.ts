import type { Page } from '@playwright/test'
import type { DesignInput, Job, PackingRequest } from '../../src/types/domain'

type Call = { command: string; args: Record<string, unknown> }
declare global {
  interface Window {
    browserMocks: {
      calls: Call[]
      savedJob: Job | null
      importError: string | null
      brokenImage: boolean
      loadError: string | null
    }
  }
}

// Browser-only contract doubles: these do not validate Rust, native dialogs,
// filesystem persistence, PNG rendering, or the real Tauri IPC transport.
export async function installBrowserMocks(page: Page) {
  await page.addInitScript(() => {
    const state: Window['browserMocks'] = {
      calls: [],
      savedJob: null,
      importError: null,
      brokenImage: false,
      loadError: null,
    }
    window.browserMocks = state
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="#2563eb"/></svg>'
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {
        convertFileSrc: () =>
          state.brokenImage
            ? 'data:image/png;base64,broken'
            : `data:image/svg+xml,${encodeURIComponent(svg)}`,
        invoke: async (command: string, args: Record<string, unknown> = {}) => {
          state.calls.push({ command, args: structuredClone(args) })
          if (command === 'plugin:dialog|open') {
            const options = args.options as { title?: string; multiple?: boolean }
            if (options.title === 'Abrir trabajo DTF') return 'C:/fixtures/trabajo.json'
            return options.multiple ? ['C:/fixtures/logo.svg'] : 'C:/fixtures/logo.svg'
          }
          if (command === 'plugin:dialog|save') {
            const options = args.options as { defaultPath?: string }
            return options.defaultPath?.endsWith('.png')
              ? 'C:/fixtures/plancha.png'
              : 'C:/fixtures/trabajo.json'
          }
          if (command === 'plugin:dialog|message') return 'Ok'
          if (command === 'import_design') {
            if (state.importError) throw state.importError
            return {
              id: 'logo',
              name: 'logo.svg',
              imagePath: 'C:/app-data/logo.svg',
              widthCm: Number(args.widthCm),
              heightCm: Number(args.heightCm),
              originalAspectRatio: 2,
              quantity: 1,
              canRotate: false,
              format: 'svg',
              visibleBounds: {
                xPx: 0,
                yPx: 0,
                widthPx: 100,
                heightPx: 50,
                sourceWidthPx: 100,
                sourceHeightPx: 50,
              },
            } satisfies DesignInput
          }
          if (command === 'run_packing') {
            const request = args.request as PackingRequest
            // Deliberately simple fixture: one copy per sheet, not a packing implementation.
            return {
              sheets: request.designs.flatMap((d) =>
                Array.from({ length: d.quantity }, (_, i) => ({
                  id: `${d.id}-${i}`,
                  ...request.sheet,
                  placements: [
                    {
                      designId: d.id,
                      xCm: 0,
                      yCm: 0,
                      widthCm: d.widthCm,
                      heightCm: d.heightCm,
                      rotated: false,
                    },
                  ],
                })),
              ),
              unplacedItems: [],
            }
          }
          if (command === 'export_png')
            return ['C:/fixtures/plancha-1.png', 'C:/fixtures/plancha-2.png']
          if (command === 'save_job') {
            state.savedJob = structuredClone(args.job as Job)
            return
          }
          if (command === 'load_job') {
            if (state.loadError) throw state.loadError
            if (!state.savedJob) throw 'file_not_found'
            return structuredClone(state.savedJob)
          }
          throw new Error(`Unexpected mocked IPC command: ${command}`)
        },
      },
    })
  })
}

export async function importThroughUi(page: Page) {
  await page.getByRole('button', { name: /Seleccionar.*PNG.*SVG/ }).click()
  await page.getByRole('spinbutton', { name: 'Ancho en centímetros', exact: true }).fill('60')
  await page.getByRole('spinbutton', { name: 'Alto en centímetros', exact: true }).fill('100')
  await page.getByRole('button', { name: 'Importar diseño', exact: true }).click()
}

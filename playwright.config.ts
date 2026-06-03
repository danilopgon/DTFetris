import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'tauri://localhost',
  },
  webServer: {
    command: 'cargo tauri dev',
    url: 'tauri://localhost',
    reuseExistingServer: !process.env.CI,
  },
})

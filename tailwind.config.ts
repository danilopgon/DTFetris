import type { Config } from 'tailwindcss'

// Utilities resolve to the Hallmark tokens in src/tokens.css; no stock palette.
const token = (name: string) => `var(--color-${name})`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: Object.fromEntries(
        [
          'paper',
          'paper-2',
          'paper-3',
          'ink',
          'ink-2',
          'muted',
          'rule',
          'accent',
          'accent-ink',
          'focus',
          'warn',
          'warn-ink',
          'error',
          'success',
          'board',
          'board-edge',
        ].map((name) => [name, token(name)]),
      ),
      fontFamily: { sans: ['var(--font-body)'] },
    },
  },
  plugins: [],
} satisfies Config

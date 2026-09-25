import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/next-sem-validator/', // project site: usc-bbh.github.io/next-sem-validator
})

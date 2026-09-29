import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages（https://oche0809.github.io/basketball-menu-warehouse/）で公開するためのパス
  base: '/basketball-menu-warehouse/',
  plugins: [react(), tailwindcss()],
})

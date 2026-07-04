import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const silphcoProxy = {
  target: 'https://silphcoanalytics.xyz',
  changeOrigin: true,
  rewrite: (path: string) => path.replace(/^\/api\/silphco/, '/api/v3'),
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api/silphco': silphcoProxy } },
  preview: { proxy: { '/api/silphco': silphcoProxy } },
})

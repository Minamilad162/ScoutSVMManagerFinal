import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-router-dom')) return 'router'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('exceljs') || id.includes('xlsx')) return 'excel'
          if (id.includes('react') || id.includes('react-dom')) return 'react-vendor'
        },
      },
    },
  },
})

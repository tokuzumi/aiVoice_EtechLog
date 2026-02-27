import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createHtmlPlugin } from 'vite-plugin-html'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [
      react(),
      createHtmlPlugin({
        minify: true,
        inject: {
          data: {
            title: env.VITE_CLIENT_TITLE || 'EtechLog - Agente de Voz Avançado',
            description: env.VITE_CLIENT_DESCRIPTION || 'Agente de Voz Avançado para Websites, otimizado para latência ultra-baixa.',
          }
        }
      })
    ],
    server: {
      host: true,
      port: 5173
    }
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      integration: {
        configureCustomSWViteBuild: (config) => {
          const output = config.build?.rollupOptions?.output
          if (!output || Array.isArray(output)) return
          // Keep the service worker as one bundle without the deprecated option.
          delete output.inlineDynamicImports
          output.codeSplitting = false
        },
      },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Dietaday - Diário Alimentar',
        short_name: 'Dietaday',
        description: 'Planeje sua dieta e registre suas refeições.',
        theme_color: '#173f35',
        background_color: '#f5f1e8',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        lang: 'pt-BR',
        icons: [
          { src: '/pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/pwa-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: { navigateFallback: '/index.html', globPatterns: ['**/*.{js,css,html,svg,png,webp}'] },
    }),
  ],
})

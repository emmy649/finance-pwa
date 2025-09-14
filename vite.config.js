import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/finance-pwa/', // <-- ИМЕТО на repo-то
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/maskable-512.png',
        'apple-touch-icon.png'
      ],
      manifest: {
        name: 'Моите финанси',
        short_name: 'Финанси',
        description: 'Лично бюджет приложение 50/30/20 с месечен одит',
        start_url: '/finance-pwa/',   // <-- важно за Pages
        scope: '/finance-pwa/',       // <-- важно за Pages
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0ea5e9',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ]
})

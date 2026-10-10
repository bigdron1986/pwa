import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Бюджет на продукты',
        short_name: 'БюджетЕда',
        description: 'Планирование недельного бюджета, генерация меню и список покупок',
        lang: 'ru',
        theme_color: '#16a34a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Кэшируем все ресурсы сборки для офлайн-работы
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Цены из Yandex Cloud Function — кэшируем с обновлением в фоне
            urlPattern: /^https:\/\/functions\.yandexcloud\.net\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'prices-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          }
        ]
      }
    })
  ],
  build: {
    sourcemap: false
  }
})

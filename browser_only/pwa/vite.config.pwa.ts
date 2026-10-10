import { VitePWA } from 'vite-plugin-pwa'

export const pwaPlugin = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.svg'],
  manifest: {
    name: 'Бюджет на продукты',
    short_name: 'Бюджет',
    description: 'Планирование бюджета на неделю, меню и список покупок',
    lang: 'ru',
    theme_color: '#16a34a',
    background_color: '#0f172a',
    display: 'standalone',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,json}'],
    navigateFallback: '/index.html'
  }
})

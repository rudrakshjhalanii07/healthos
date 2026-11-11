// Generates dist/client/sw.js after `expo export -p web`. Run via `npm run build:web`.
module.exports = {
  globDirectory: 'dist/client/',
  globPatterns: ['**/*.{js,css,html,json,png,ico,ttf,woff,woff2}'],
  swDest: 'dist/client/sw.js',
  // Expo's hashed JS bundles can exceed Workbox's 2 MB default.
  maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
  navigateFallback: '/index.html',
  // API calls must always reach the server, never a cached page.
  navigateFallbackDenylist: [/^\/api\//],
  clientsClaim: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'google-fonts-stylesheets' },
    },
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-webfonts',
        cacheableResponse: { statuses: [0, 200] },
        expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },
  ],
};

import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { PALETTES, themeCss } from '@/constants/theme';
import { istSun } from '@/lib/sun';
import { THEME_KEY } from '@/lib/theme-mode';

// Runs before first paint: picks the saved theme, or light/dark by IST sunrise/sunset, so the
// page never flashes the wrong palette. `istSun` is self-contained, so its source can be inlined.
const pickTheme = `
(function () {
  var istSun = ${istSun.toString()};
  var mode = null;
  try { mode = localStorage.getItem(${JSON.stringify(THEME_KEY)}); } catch (e) {}
  var theme = mode === 'light' || mode === 'dark' ? mode : (istSun(Date.now()).isDay ? 'light' : 'dark');
  document.documentElement.dataset.theme = theme;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? ${JSON.stringify(PALETTES.light.bg)} : ${JSON.stringify(PALETTES.dark.bg)});
})();
`;

// Only register in production builds; a service worker in dev would serve stale bundles.
const registerServiceWorker = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="light dark" />

        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HealthOS" />

        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
        <script dangerouslySetInnerHTML={{ __html: pickTheme }} />
        <ScrollViewStyleReset />
        {process.env.NODE_ENV === 'production' && (
          <script dangerouslySetInnerHTML={{ __html: registerServiceWorker }} />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}

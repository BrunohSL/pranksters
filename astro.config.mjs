// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
  },

  // GitHub Pages: repositório "prankstersvgc.github.io" dentro da organização "prankstersvgc"
  // -> o site fica na raiz, sem caminho base.
  site: 'https://prankstersvgc.github.io',
  base: '/pranksters'
});

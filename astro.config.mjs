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

  // GitHub Pages:
  // - Se o repositório for "<seu-usuario>.github.io", o site fica na raiz:
  //     site: 'https://<seu-usuario>.github.io',
  //     (deixe `base` removido / como '/')
  // - Se o repositório tiver outro nome (ex: "pranksters"), o site fica em um subcaminho:
  //     site: 'https://<seu-usuario>.github.io',
  //     base: '/pranksters',
  site: 'https://SEU-USUARIO.github.io',
  base: '/pranksters',
});

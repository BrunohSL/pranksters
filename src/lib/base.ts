const raw = import.meta.env.BASE_URL;

// Garante uma barra no final independente de como `base` foi configurado
// no astro.config.mjs (com ou sem "/" no fim).
export const base = raw.endsWith('/') ? raw : `${raw}/`;

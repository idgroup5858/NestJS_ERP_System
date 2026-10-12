/**
 * Tizimning asosiy rangi (accent) variantlari. Kalitlar web'dagi `theme/appearance.js` bilan bir xil bo'lishi shart.
 * Birinchisi — standart.
 */
export const ACCENTS = ['indigo', 'blue', 'cyan', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'violet'] as const;
export type Accent = (typeof ACCENTS)[number];
export const DEFAULT_ACCENT: Accent = 'indigo';

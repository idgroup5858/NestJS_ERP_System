import { ColumnOptions } from 'typeorm';

/**
 * Miqdor o'nli ham bo'lishi mumkin (metr, kg): 3 xonagacha. `numeric` ustunini
 * pg qator qilib qaytaradi, shuning uchun transformer uni songa aylantiradi.
 * Bu ustunning bazadagi turi `prepareSchema` da ham tilga olinadi — ikkalasi mos bo'lishi shart.
 */
export const QUANTITY_COLUMN: ColumnOptions = {
  type: 'numeric',
  precision: 14,
  scale: 3,
  transformer: {
    to: (value?: number | null) => value,
    from: (value?: string | null) => (value == null ? value : parseFloat(value)),
  },
};

/** 0.1 + 0.2 kabi suzuvchi nuqta xatolarini 3 xonada yaxlitlaydi. */
export const roundQuantity = (value: number) => Math.round(value * 1000) / 1000;

/** Miqdor × narx yig'indisini butun so'mga yaxlitlaydi (summa ustunlari butun son). */
export const roundMoney = (value: number) => Math.round(value);

/**
 * Birinchi ishga tushishda `expense_category` jadvaliga yoziladigan tayyor turlar. Keyin ro'yxat
 * UI da tahrirlanadi (qayta nomlash, o'chirish); "Другое" bilan yozilgan yangi tur ham unga qo'shiladi.
 */
export const DEFAULT_EXPENSE_CATEGORIES = [
  'Газ',
  'Свет',
  'Вода',
  'Аренда',
  'Зарплата',
  'Интернет и связь',
  'Налоги',
  'Транспорт и доставка',
  'Топливо',
  'Ремонт и обслуживание',
  'Хозтовары',
  'Реклама',
  'Канцтовары',
  'Охрана',
  'Банковские комиссии',
] as const;

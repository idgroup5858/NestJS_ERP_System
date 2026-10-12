/**
 * Qarzga boʻlgan savdodan qaytarishda summa pul qilib berilmay, qarzdan
 * ayiriladi. Bu ikki tomonda shu usuldagi toʻlov sifatida yoziladi:
 * savdoda (qarz kamayadi) va qaytarishda (qaytarish yopiladi).
 */
export const OFFSET_METHOD = 'Зачёт возврата';

/**
 * "По договору" — kassada tanlanadigan to'lov turi: savdo bank o'tkazmasi bilan, shartnoma asosida.
 * Savdo qarz sifatida yoziladi (to'lov 0), shartnoma avtomatik ochiladi.
 */
export const CONTRACT_METHOD = 'По договору';

/** Buxgalter shartnoma kartochkasidan kiritadigan bank o'tkazmasi (qarzni yopadi). */
export const TRANSFER_METHOD = 'Перечисление';

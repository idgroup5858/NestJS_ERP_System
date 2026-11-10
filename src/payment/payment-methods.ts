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

/**
 * Kassadagi "В долг": savdoda to'lov 0 bilan belgi sifatida yoziladi (summa qarzga qoladi). Savdo tafsilotidan
 * qarz to'langanda ham shu usulda (summa bilan) yoziladi.
 */
export const DEBT_METHOD = 'В долг';

/** Buxgalter shartnoma kartochkasidan kiritadigan bank o'tkazmasi (qarzni yopadi). */
export const TRANSFER_METHOD = 'Перечисление';

/**
 * Savdo mijozning balansidan to'landi. Bu kassaga pul kelishi emas: pul balansga avval tushgan
 * (avans yoki qaytarishdan qolgan summa). Har bir shunday to'lovga balans tarixida chiqim yozuvi bog'langan.
 */
export const BALANCE_PAY_METHOD = 'С баланса';

/** Qaytarish summasi mijozga naqd berilmadi, uning balansiga yozildi (kassadan pul chiqmaydi). */
export const BALANCE_REFUND_METHOD = 'На баланс';

/**
 * Pul harakati bo'lmagan to'lov usullari: qarzni yoki qaytarishni yopadi, lekin kassaga kirim/chiqim emas.
 * SQL da: `method <> ALL($n::varchar[])`.
 */
export const NON_CASH_METHODS = [OFFSET_METHOD, BALANCE_PAY_METHOD, BALANCE_REFUND_METHOD];

/** Bu usullardagi to'lovlar faqat o'z jarayoni orqali yoziladi (qaytarish, balans) — oddiy to'lov sifatida emas. */
export const isNonCashMethod = (method?: string | null) => NON_CASH_METHODS.includes((method ?? '').trim());

/**
 * Shartnoma holatlari:
 *  draft -> signed -> active  (qo'lda o'zgartiriladi)
 *  review  — buxgalter "yopdi", admin tekshiruvini kutmoqda
 *  closed  — admin tasdiqladi; kim yopgani (closedBy) shu paytda yoziladi
 *  cancelled — bekor qilingan
 * `review` va `closed` ga faqat submit/approve orqali o'tiladi.
 */
export const CONTRACT_STATUSES = ['draft', 'signed', 'active', 'review', 'closed', 'cancelled'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

/** Qo'lda tanlanadigan holatlar. */
export const MANUAL_STATUSES = ['draft', 'signed', 'active', 'cancelled'] as const;

/** Tekshiruvga yuborish mumkin bo'lgan holatlar. */
export const SUBMITTABLE: ContractStatus[] = ['draft', 'signed', 'active'];

export const CONTRACT_CURRENCIES = ['UZS', 'USD'] as const;

/**
 * Savdolar ro'yxati filtrlari (`GET /sale/allpagsearch`). Hammasi ixtiyoriy va bir-biri bilan birga ishlaydi.
 *  - `search` — kontragent (ism, tashkilot, telefon), sotgan xodim, usta nomi yoki savdo raqami (#123);
 *  - `debt` — faqat qarzi qolgan savdolar;
 *  - `master_id` — shu usta xizmat ko'rsatgan savdolar;
 *  - `user_id` — shu xodim (kassir yoki admin) sotgan savdolar;
 *  - `customer_id` — shu kontragentning savdolari.
 */
export interface SaleListFilter {
    search?: string;
    debt?: boolean;
    masterId?: number;
    userId?: number;
    customerId?: number;
}

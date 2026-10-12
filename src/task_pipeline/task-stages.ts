/**
 * Vazifalar jarayoni (voronka) va etaplari.
 *
 * Etap turi qoidalarni belgilaydi:
 *  - normal — oddiy ish etapi (Новая, В работе, Документы ...);
 *  - review — "На проверке": ijrochi vazifani shu yerga o'tkazib "yopadi";
 *  - done   — "Закрыта": faqat administrator tasdiqlab shu etapga o'tkaza oladi.
 * Har bir jarayonda bittadan review va done etapi bor; ular doim oxirida turadi.
 */
export const STAGE_TYPES = ['normal', 'review', 'done'] as const;
export type StageType = (typeof STAGE_TYPES)[number];

/** Veb'dagi Badge ohanglari (tone) bilan bir xil nomlar. */
export const STAGE_COLORS = ['neutral', 'info', 'primary', 'success', 'warning', 'danger'] as const;
export type StageColor = (typeof STAGE_COLORS)[number];

/** Vazifa holati: "open" — oddiy etap, "review" — tekshiruvda, "done" — yopilgan. */
export type TaskState = 'open' | 'review' | 'done';

export const taskState = (type: StageType | undefined | null): TaskState =>
  type === 'review' ? 'review' : type === 'done' ? 'done' : 'open';

/** Etaplar tartibi: oddiylar, keyin review, eng oxirida done. */
export const STAGE_TYPE_RANK: Record<StageType, number> = { normal: 0, review: 1, done: 2 };

export interface DefaultStage {
  name: string;
  color: StageColor;
  type: StageType;
}

const REVIEW: DefaultStage = { name: 'На проверке', color: 'warning', type: 'review' };
const DONE: DefaultStage = { name: 'Закрыта', color: 'success', type: 'done' };

/** Boshlang'ich jarayonlar; admin keyin tahrirlaydi. Nomlar bazadagi boshqa ma'lumotlar kabi ruscha. */
export const DEFAULT_PIPELINES: { name: string; forContracts?: boolean; stages: DefaultStage[] }[] = [
  {
    name: 'Обычная задача',
    stages: [
      { name: 'Новая', color: 'info', type: 'normal' },
      { name: 'В работе', color: 'primary', type: 'normal' },
      REVIEW,
      DONE,
    ],
  },
  {
    name: 'По договору',
    forContracts: true,
    stages: [
      { name: 'Новая', color: 'info', type: 'normal' },
      { name: 'Документы', color: 'neutral', type: 'normal' },
      { name: 'Подписание', color: 'primary', type: 'normal' },
      { name: 'Оплата', color: 'primary', type: 'normal' },
      REVIEW,
      DONE,
    ],
  },
];

/** Eski, etapsiz voronkalarga beriladigan standart etaplar. */
export const FALLBACK_STAGES: DefaultStage[] = DEFAULT_PIPELINES[0].stages;

export const sortStages = <T extends { type: StageType; order_id: number; id: number }>(stages: T[]) =>
  [...stages].sort(
    (a, b) =>
      STAGE_TYPE_RANK[a.type] - STAGE_TYPE_RANK[b.type] || a.order_id - b.order_id || a.id - b.id,
  );

import { Logger } from '@nestjs/common';
import { Client, ClientConfig } from 'pg';

/**
 * `synchronize` ustun turi o'zgarganda ustunni O'CHIRIB qayta yaratadi — ya'ni
 * integer → numeric o'zgarishida butun ombor/savdo miqdorlari yo'qolardi.
 * Shu sababli turi qo'lda, ma'lumotni saqlab o'zgartiriladi (`USING`), keyin
 * `synchronize` ustun allaqachon mos ekanini ko'rib, tegmaydi.
 *
 * Idempotent: ustun yoki jadval yo'q (yangi baza) yoki allaqachon numeric bo'lsa — hech narsa qilmaydi.
 */
const QUANTITY_SQL = `
DO $$
DECLARE target record;
BEGIN
  FOR target IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND column_name = 'quantity'
      AND data_type = 'integer'
      AND table_name IN ('stock', 'sale_item', 'purchase_item', 'return_item')
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE numeric(14,3) USING %I::numeric',
      target.table_name, target.column_name, target.column_name
    );
  END LOOP;
END $$;
`;

const ATTEMPTS = 30;
const DELAY_MS = 2000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Baza hali ishga tushmagan bo'lsa (server qayta yoqilganda) kutadi. Ulana olmasdan
 * davom etib bo'lmaydi: keyin TypeORM o'zi ulanib, migratsiyasiz `synchronize` qilardi.
 */
export async function prepareSchema(config: ClientConfig) {
  const logger = new Logger('PrepareSchema');
  let lastError: unknown;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const client = new Client(config);
    try {
      await client.connect();
      await client.query(QUANTITY_SQL);
      return;
    } catch (error) {
      lastError = error;
      logger.warn(`Baza tayyor emas (${attempt}/${ATTEMPTS}): ${(error as Error).message}`);
      await sleep(DELAY_MS);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  throw lastError;
}

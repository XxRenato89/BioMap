import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { recordAudit } from '../../src/audit/audit.service.js';
import { createTestPool, describeWithDb, resetDatabase, truncateAll } from './db-helper.js';

describeWithDb('recordAudit (database)', () => {
  let pool;

  beforeAll(async () => {
    pool = createTestPool();
    await resetDatabase(pool);
  });
  afterAll(async () => {
    await pool?.end();
  });
  beforeEach(async () => {
    await truncateAll(pool);
  });

  it('stores the row with jsonb details', async () => {
    const id = await recordAudit(pool, {
      action: 'delete',
      entity: 'point',
      entityId: 3,
      details: { reason: 'duplicado' },
    });
    const { rows } = await pool.query('SELECT * FROM audit_log WHERE id = $1', [id]);
    expect(rows[0]).toMatchObject({
      user_id: null,
      action: 'delete',
      entity: 'point',
      entity_id: 3,
      details: { reason: 'duplicado' },
    });
  });
});

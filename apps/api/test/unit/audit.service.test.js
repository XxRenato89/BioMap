import { describe, expect, it } from 'vitest';
import { recordAudit } from '../../src/audit/audit.service.js';

/**
 * Base de datos falsa que guarda la última consulta recibida.
 */
function capturingDb() {
  const db = {
    last: null,
    async query(sql, params) {
      db.last = { sql, params };
      return { rows: [{ id: '42' }] };
    },
  };
  return db;
}

describe('recordAudit', () => {
  it('inserts one audit row and returns its id', async () => {
    const db = capturingDb();
    const id = await recordAudit(db, {
      userId: 5,
      action: 'update',
      entity: 'point',
      entityId: 9,
      details: { field: 'name' },
    });
    expect(id).toBe('42');
    expect(db.last.sql).toContain('INSERT INTO audit_log');
    expect(db.last.params).toEqual([5, 'update', 'point', 9, '{"field":"name"}']);
  });

  it('defaults userId and details to null', async () => {
    const db = capturingDb();
    await recordAudit(db, { action: 'create', entity: 'image', entityId: 1 });
    expect(db.last.params).toEqual([null, 'create', 'image', 1, null]);
  });

  it.each([
    [{ action: 'drop', entity: 'point', entityId: 1 }, /action/],
    [{ action: 'create', entity: 'user', entityId: 1 }, /entity/],
    [{ action: 'create', entity: 'point', entityId: 0 }, /entityId/],
    [{ action: 'create', entity: 'point', entityId: 1.5 }, /entityId/],
  ])('rejects invalid input %j', async (input, message) => {
    const db = capturingDb();
    await expect(recordAudit(db, input)).rejects.toThrow(message);
    expect(db.last).toBeNull();
  });
});

import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createAdminRepository } from '../../src/admin/admin.repository.js';
import { createTestPool, describeWithDb, resetDatabase, truncateAll } from './db-helper.js';

describeWithDb('admin repository (database)', () => {
  let pool;
  let repo;
  let layerId;
  let userId;

  beforeAll(async () => {
    pool = createTestPool();
    await resetDatabase(pool);
    repo = createAdminRepository(pool);
  });
  afterAll(async () => {
    await pool?.end();
  });
  beforeEach(async () => {
    await truncateAll(pool);
    ({
      rows: [{ id: layerId }],
    } = await pool.query(
      "INSERT INTO layers (slug, name, color) VALUES ('tourism', 'Turismo', '#1d4ed8') RETURNING id",
    ));
    ({
      rows: [{ id: userId }],
    } = await pool.query(
      "INSERT INTO admin_users (username, password_hash) VALUES ('admin', 'x') RETURNING id",
    ));
  });

  it('allows a single administrator', async () => {
    await expect(
      pool.query("INSERT INTO admin_users (username, password_hash) VALUES ('otro', 'y')"),
    ).rejects.toThrow(/admin_users_single_idx/);
  });

  it('starts with a forced password change, cleared by setPassword', async () => {
    expect((await repo.findUserByUsername('ADMIN')).mustChangePassword).toBe(true);
    const changedAt = await repo.setPassword(userId, 'nuevo');
    const user = await repo.findUserById(userId);
    expect(user).toMatchObject({ passwordHash: 'nuevo', mustChangePassword: false });
    expect(user.passwordChangedAt).toEqual(changedAt);
  });

  it('counts recent failures per username', async () => {
    await repo.recordLoginAttempt({ username: 'admin', ip: '10.0.0.2', succeeded: false });
    await repo.recordLoginAttempt({ username: 'Admin', ip: null, succeeded: false });
    await repo.recordLoginAttempt({ username: 'admin', ip: null, succeeded: true });
    expect(await repo.countFailures('admin', new Date(Date.now() - 60_000))).toBe(2);
  });

  it('creates, edits, deletes and restores a point; deleting frees its tour stop', async () => {
    const id = await repo.createPoint(
      { name: 'Mirador', layerId, lng: -71.8, lat: -37.72, tourStop: 5 },
      userId,
    );
    await repo.updatePoint(id, { name: 'Mirador Sur', lng: -71.81, lat: -37.73 }, userId);
    expect(await repo.findPoint(id)).toMatchObject({
      name: 'Mirador Sur',
      lng: -71.81,
      lat: -37.73,
      tourStop: 5,
      isSecret: false,
    });
    expect(await repo.setPointDeleted(id, true, userId)).toBe(true);
    expect(await repo.setPointDeleted(id, true, userId)).toBe(false);
    expect((await repo.findPoint(id)).tourStop).toBeNull();
    expect(await repo.setPointDeleted(id, false, userId)).toBe(true);
    expect((await repo.findPoint(id)).deletedAt).toBeNull();
  });

  it('keeps a single main image per point', async () => {
    const pointId = await repo.createPoint(
      { name: 'Playa', layerId, lng: -71.8, lat: -37.72 },
      userId,
    );
    const image = (filePath, isMain) => ({
      pointId,
      filePath,
      altText: 'Foto',
      credit: 'Colbún',
      kind: 'photo',
      isMain,
    });
    const first = await repo.addImage(image('a.jpg', true));
    const second = await repo.addImage(image('b.jpg', true));
    let { images } = await repo.findPoint(pointId);
    expect(images.filter((i) => i.isMain).map((i) => i.id)).toEqual([second]);
    await repo.updateImage(first, { isMain: true, credit: 'Parque Angostura' });
    ({ images } = await repo.findPoint(pointId));
    expect(images[0]).toMatchObject({ id: first, isMain: true, credit: 'Parque Angostura' });
    expect(await repo.deleteImage(second)).toBe(pointId);
  });

  it('counts visits per point and per day', async () => {
    const pointId = await repo.createPoint(
      { name: 'Central', layerId, lng: -71.8, lat: -37.72 },
      userId,
    );
    await repo.recordVisit({ type: 'point_open', pointId });
    await repo.recordVisit({ type: 'point_open', pointId });
    await repo.recordVisit({ type: 'tour_complete' });
    const now = Date.now();
    const stats = await repo.visitStats(new Date(now - 86_400_000), new Date(now + 60_000));
    expect(stats.byPoint).toEqual([{ id: pointId, name: 'Central', visits: 2 }]);
    expect(stats.byDay.reduce((sum, day) => sum + day.tours, 0)).toBe(1);
  });
});

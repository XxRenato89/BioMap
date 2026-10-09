import { describe, expect, it } from 'vitest';
import { assertTestDatabase } from '../integration/db-guard.js';

describe('assertTestDatabase', () => {
  it('accepts a database whose name ends in _test', () => {
    expect(() =>
      assertTestDatabase('postgres://biomap:biomap@localhost:5432/biomap_test'),
    ).not.toThrow();
  });

  it('refuses the development database', () => {
    expect(() => assertTestDatabase('postgres://biomap:biomap@localhost:5432/biomap')).toThrow(
      /_test/,
    );
  });

  it('ignores query parameters when reading the database name', () => {
    expect(() =>
      assertTestDatabase('postgres://u@localhost:5432/biomap_test?sslmode=disable'),
    ).not.toThrow();
    expect(() => assertTestDatabase('postgres://u@localhost:5432/biomap?x=_test')).toThrow();
  });
});

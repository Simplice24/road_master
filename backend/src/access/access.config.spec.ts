import { Prisma } from '../../generated/prisma/client';
import {
  ACCESS_CONFIG,
  PERMISSION_DEFINITIONS,
  getPermissionCatalog,
  isPermissionName,
} from './access.config';

describe('ACCESS_CONFIG', () => {
  const modelNames = new Set<string>(Object.values(Prisma.ModelName));
  const actions = new Set(['create', 'read', 'update', 'delete', 'manage']);

  it('gives every permission a unique <module>.<action> name', () => {
    const names = PERMISSION_DEFINITIONS.map((definition) => definition.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^[a-z][A-Za-z]*\.[a-z][A-Za-z]*$/);
    }
  });

  it('maps every permission onto a real Prisma model and CASL action', () => {
    for (const { name, rule } of PERMISSION_DEFINITIONS) {
      expect({ name, subject: modelNames.has(rule.subject) }).toEqual({
        name,
        subject: true,
      });
      expect({ name, action: actions.has(rule.action) }).toEqual({
        name,
        action: true,
      });
    }
  });

  it('scopes every *Own permission to the caller via a ${user.*} condition', () => {
    const own = PERMISSION_DEFINITIONS.filter((d) => d.action.endsWith('Own'));
    expect(own.length).toBeGreaterThan(0);
    const unscoped = own
      .filter(
        ({ rule }) => !JSON.stringify(rule.conditions).includes('${user.'),
      )
      .map(({ name }) => name);
    expect(unscoped).toEqual([]);
  });

  it('serves a catalog that lists exactly the configured permissions', () => {
    const catalogNames = getPermissionCatalog().flatMap((module) =>
      module.actions.map((action) => action.name),
    );
    expect(catalogNames).toEqual(PERMISSION_DEFINITIONS.map((d) => d.name));
    expect(getPermissionCatalog().map((m) => m.module)).toEqual(
      Object.keys(ACCESS_CONFIG),
    );
  });

  it('recognizes only configured names', () => {
    expect(isPermissionName('categories.create')).toBe(true);
    expect(isPermissionName('categories.launchMissiles')).toBe(false);
    expect(isPermissionName('')).toBe(false);
  });
});

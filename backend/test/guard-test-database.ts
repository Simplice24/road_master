/**
 * E2E suites wipe the tables they touch (see rbac-bootstrap.e2e-spec.ts), so they must never
 * run against a development or production database. Loaded via jest-e2e.json `setupFiles`
 * (after dotenv/config), this aborts every e2e suite before any test code runs unless
 * DATABASE_URL points at a database whose name contains "test".
 */
function databaseName(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    return null;
  }
}

const dbName = databaseName(process.env.DATABASE_URL);
if (!dbName || !dbName.toLowerCase().includes('test')) {
  throw new Error(
    `Refusing to run e2e tests: DATABASE_URL points at database "${dbName ?? '(unparseable)'}". ` +
      'E2E tests delete data — point DATABASE_URL at a database whose name contains "test" ' +
      '(e.g. DATABASE_URL=mysql://user:pass@localhost:3306/road_master_test npm run test:e2e).',
  );
}

export {};

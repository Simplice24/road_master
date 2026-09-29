import type { Actions, Subjects } from '../casl/casl-ability.factory';

/**
 * Single source of truth for every permission in the system. Each entry is a stable name
 * (`<module>.<action>`, e.g. `categories.create`) mapped to exactly one CASL rule — the rule is
 * what the backend actually enforces (PoliciesGuard + accessibleBy + policy-assertions); the
 * name is what roles are assigned and what the frontend checks for UX.
 *
 * PermissionSyncService makes the `permissions` table match this file on startup and whenever
 * a role is saved. Adding a permission = adding an entry here; no seeding or DB edit needed.
 *
 * `*Own` actions carry a `${user.id}` condition (interpolated per request by
 * CaslAbilityFactory), so they only ever match the caller's own rows. Their unsuffixed
 * counterparts are the unconditioned, all-users variants for staff roles.
 */
export interface AccessRule {
  action: Actions;
  subject: Exclude<Subjects, 'all'>;
  conditions?: Record<string, unknown>;
}

export interface AccessAction {
  label: string;
  rule: AccessRule;
}

export interface AccessModule {
  label: string;
  actions: Record<string, AccessAction>;
}

const OWN_USER = { userId: '${user.id}' };

export const ACCESS_CONFIG = {
  categories: {
    label: 'Categories',
    actions: {
      view: { label: 'View', rule: { action: 'read', subject: 'Category' } },
      create: {
        label: 'Create',
        rule: { action: 'create', subject: 'Category' },
      },
      update: {
        label: 'Edit',
        rule: { action: 'update', subject: 'Category' },
      },
      delete: {
        label: 'Delete',
        rule: { action: 'delete', subject: 'Category' },
      },
    },
  },
  questions: {
    label: 'Questions',
    actions: {
      view: { label: 'View', rule: { action: 'read', subject: 'Question' } },
      create: {
        label: 'Create',
        rule: { action: 'create', subject: 'Question' },
      },
      update: {
        label: 'Edit',
        rule: { action: 'update', subject: 'Question' },
      },
      delete: {
        label: 'Delete',
        rule: { action: 'delete', subject: 'Question' },
      },
    },
  },
  examConfig: {
    label: 'Exam config',
    actions: {
      view: { label: 'View', rule: { action: 'read', subject: 'ExamConfig' } },
      create: {
        label: 'Create',
        rule: { action: 'create', subject: 'ExamConfig' },
      },
      update: {
        label: 'Edit',
        rule: { action: 'update', subject: 'ExamConfig' },
      },
      delete: {
        label: 'Delete',
        rule: { action: 'delete', subject: 'ExamConfig' },
      },
    },
  },
  examAttempts: {
    label: 'Exam attempts',
    actions: {
      viewOwn: {
        label: 'View own',
        rule: { action: 'read', subject: 'ExamAttempt', conditions: OWN_USER },
      },
      start: {
        label: 'Start',
        rule: { action: 'create', subject: 'ExamAttempt' },
      },
      answerOwn: {
        label: 'Answer own',
        rule: {
          action: 'update',
          subject: 'ExamAttempt',
          conditions: OWN_USER,
        },
      },
      view: {
        label: 'View all',
        rule: { action: 'read', subject: 'ExamAttempt' },
      },
    },
  },
  transactions: {
    label: 'Transactions',
    actions: {
      viewOwn: {
        label: 'View own',
        rule: { action: 'read', subject: 'Transaction', conditions: OWN_USER },
      },
      topUpOwn: {
        label: 'Top up own wallet',
        rule: {
          action: 'create',
          subject: 'Transaction',
          conditions: OWN_USER,
        },
      },
      view: {
        label: 'View all',
        rule: { action: 'read', subject: 'Transaction' },
      },
    },
  },
  users: {
    label: 'Users',
    actions: {
      viewOwn: {
        label: 'View own profile',
        rule: {
          action: 'read',
          subject: 'User',
          conditions: { id: '${user.id}' },
        },
      },
      updateOwn: {
        label: 'Edit own profile',
        rule: {
          action: 'update',
          subject: 'User',
          conditions: { id: '${user.id}' },
        },
      },
      view: { label: 'View', rule: { action: 'read', subject: 'User' } },
      create: { label: 'Create', rule: { action: 'create', subject: 'User' } },
      update: { label: 'Edit', rule: { action: 'update', subject: 'User' } },
    },
  },
  roles: {
    label: 'Roles',
    actions: {
      view: { label: 'View', rule: { action: 'read', subject: 'Role' } },
      create: { label: 'Create', rule: { action: 'create', subject: 'Role' } },
      update: { label: 'Edit', rule: { action: 'update', subject: 'Role' } },
      delete: { label: 'Delete', rule: { action: 'delete', subject: 'Role' } },
      assign: {
        label: 'Assign to users',
        rule: { action: 'manage', subject: 'UserRole' },
      },
    },
  },
} as const satisfies Record<string, AccessModule>;

type Config = typeof ACCESS_CONFIG;
export type PermissionName = {
  [M in keyof Config]: `${M & string}.${keyof Config[M]['actions'] & string}`;
}[keyof Config];

export interface PermissionDefinition {
  name: PermissionName;
  module: string;
  action: string;
  label: string;
  rule: AccessRule;
}

/** Flat list of every configured permission, in config order. */
export const PERMISSION_DEFINITIONS: PermissionDefinition[] = Object.entries(
  ACCESS_CONFIG as Record<string, AccessModule>,
).flatMap(([module, config]) =>
  Object.entries(config.actions).map(([action, definition]) => ({
    name: `${module}.${action}` as PermissionName,
    module,
    action,
    label: definition.label,
    rule: definition.rule,
  })),
);

const DEFINITIONS_BY_NAME = new Map<string, PermissionDefinition>(
  PERMISSION_DEFINITIONS.map((definition) => [definition.name, definition]),
);

export function getPermissionDefinition(
  name: string,
): PermissionDefinition | undefined {
  return DEFINITIONS_BY_NAME.get(name);
}

export function isPermissionName(name: string): name is PermissionName {
  return DEFINITIONS_BY_NAME.has(name);
}

/** The catalog served to the frontend's role permission picker, grouped by module. */
export function getPermissionCatalog() {
  return Object.entries(ACCESS_CONFIG as Record<string, AccessModule>).map(
    ([module, config]) => ({
      module,
      label: config.label,
      actions: Object.entries(config.actions).map(([action, definition]) => ({
        name: `${module}.${action}`,
        action,
        label: definition.label,
      })),
    }),
  );
}

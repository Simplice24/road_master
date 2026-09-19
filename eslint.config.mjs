// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      ecmaVersion: 5,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn'
    },
  },
  {
    // @casl/prisma's published types import `Prisma` from the default `@prisma/client`
    // export, which (with this project's Prisma 7 `prisma-client` generator + custom
    // `generated/prisma` output) re-exports a `.prisma/client/default` module that is never
    // generated. That makes every type derived from AppAbility/PrismaAbility resolve to an
    // unresolvable/`any` type for ESLint, even though `tsc` and the actual runtime behavior
    // (verified against @casl/ability's AbilityBuilder implementation) are both correct. This
    // is an upstream @casl/prisma <-> Prisma 7 custom-output typing gap, not a real unsafe
    // access in this code, so the no-unsafe-* rules are relaxed only where CASL types flow.
    files: [
      'src/casl/**/*.ts',
      'src/users/users.service.ts',
      'src/exam-attempts/**/*.ts',
      'src/category/**/*.ts',
      'src/question/**/*.ts',
      'test/rbac-bootstrap.e2e-spec.ts',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
);
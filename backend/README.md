<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## RBAC (roles & permissions)

Access control is entirely database-driven, built on [CASL](https://casl.js.org/) and modeled
after `spatie/laravel-permission`: roles and permissions are rows, not code. The only two
things the codebase is ever allowed to branch on directly are `Role.isSuperAdmin` and the
`DefaultRole` singleton pointer — never a role or permission *name*.

### Data model

- **Role** — `name`, `description`, `isSuperAdmin`. A role with `isSuperAdmin: true` bypasses
  all permission checks (see below) and needs zero `Permission` rows.
- **DefaultRole** — a singleton pointer table (`id` pinned to `1` as the primary key, so a
  second row can never be inserted). Points at the role every user *after* the first receives
  automatically. Set it with:
  ```ts
  prisma.defaultRole.upsert({ where: { id: 1 }, update: { roleId }, create: { id: 1, roleId } });
  ```
- **Permission** — `action` (`create` | `read` | `update` | `delete` | `manage`), `subject`
  (any Prisma model name, or `all`), optional `conditions` (JSON, CASL-style, supports
  `${user.path}` placeholders for row-level rules), optional `fields` (JSON array, for
  field-level restriction).
- **RolePermission** / **UserRole** — join tables. A user can hold multiple roles; a role can
  hold multiple permissions. There are no direct user→permission grants — everything flows
  through roles.

### How the ability is built (`CaslAbilityFactory`)

On each authorized request, `PoliciesGuard` calls `CaslAbilityFactory.createForUser(user)`
(cached on `request.ability` for the rest of the request) which:

1. Loads the user's roles and each role's permissions in one query.
2. If any role has `isSuperAdmin: true`, short-circuits to `can('manage', 'all')`.
3. Otherwise, for every attached `Permission` row, interpolates any `${user.field}`
   placeholders in `conditions` against the real user record, then calls
   `can(action, subject, fields?, conditions?)` on CASL's `AbilityBuilder`.

The result is a CASL `Ability` — the same object `@RequirePermission()`, `@CheckPolicies()`,
and `accessibleBy()` (see `GET /exam-attempts` for a worked example that turns a user's row-level
conditions straight into a Prisma `where` clause) all consume.

### Adding a new role or permission (no redeploy)

```
POST /permissions   { "action": "update", "subject": "ExamAttempt",
                       "conditions": { "userId": "${user.id}" } }
POST /roles          { "name": "exam-marker" }
POST /roles/:id/permissions   { "permissionId": "..." }
POST /users/:id/roles         { "roleId": "..." }
```

That user's next request immediately reflects the new permission — nothing in the app was
touched. `GET /users/:id/effective-permissions` returns the fully resolved rule set for
debugging or for the frontend to conditionally render UI.

### SuperAdmin / default-role bootstrap

`UsersService.create()` is the single code path all user creation goes through (registration,
seed scripts, future admin-invite flows). Inside one `Serializable`-isolation transaction:

- If `user.count() === 0`, this is the first user ever created: it gets a `Role` with
  `isSuperAdmin: true` (found-or-created by that flag, never by name) with zero `Permission`
  rows attached.
- Otherwise, it gets whatever role the singleton `DefaultRole` row points at — seeded as
  `client` by `prisma/seed.ts`, but changeable at any time via `POST /roles/:id/default`.

Run `npm run seed` after your first `npx prisma migrate dev` to create the default `client`
role and its `DefaultRole` pointer before anyone registers.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

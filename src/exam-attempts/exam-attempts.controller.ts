import { Controller, Get } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermission } from '../casl/decorators/check-policies.decorator';
import { CurrentAbility } from '../casl/decorators/current-ability.decorator';
import { AppAbility } from '../casl/casl-ability.factory';
import { Prisma } from '../../generated/prisma/client';

@Controller('exam-attempts')
export class ExamAttemptsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('read', 'ExamAttempt')
  findAll(@CurrentAbility() abilityParam: unknown) {
    // Typed via a local cast rather than annotating the decorated parameter directly:
    // emitDecoratorMetadata tries to emit a runtime reference for a type-only alias like
    // AppAbility (it resolves through a generic class instantiation, not a plain interface),
    // and since AppAbility has no runtime value, that reference is undefined at import time —
    // "casl_ability_factory_1 is not defined". Casting here keeps the parameter type-safe
    // inside the method without triggering that reflect-metadata emission bug.
    const ability = abilityParam as AppAbility;
    // accessibleBy() turns the caller's CASL rules — including any row-level `conditions`
    // stored on their Permission rows, e.g. { userId: "${user.id}" } — into a Prisma `where`
    // clause. There is no `if (user.role === ...)` branching anywhere in this service: a
    // client with only an owner-scoped "read ExamAttempt" permission automatically gets
    // filtered to their own attempts, and a role with an unconditioned "read ExamAttempt"
    // permission sees everything, purely from what's stored in the Permission table.
    //
    // @casl/prisma's published types resolve against the default `@prisma/client` export, not
    // this project's custom `prisma-client` output path (see prisma/schema.prisma), so its
    // return type doesn't line up with our generated Prisma.ExamAttemptWhereInput — this cast
    // bridges that known typing gap, not a correctness shortcut.
    const where = accessibleBy(ability, 'read').ofType(
      'ExamAttempt',
    ) as unknown as Prisma.ExamAttemptWhereInput;

    return this.prisma.examAttempt.findMany({ where });
  }
}

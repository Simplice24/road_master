import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { Prisma, PrismaClient } from '../../generated/prisma/client';

// Fields that must never leave the database by default. Omitted globally so no endpoint can
// leak them by returning a raw user row — the one place that needs the hash (password
// verification in AuthService) opts back in per query with `omit: { passwordHash: false }`.
export const GLOBAL_OMIT = {
  user: { passwordHash: true },
} as const satisfies Prisma.GlobalOmitConfig;

// `PrismaClient`'s runtime constructor is typed to return the default (no-omit) client, so
// extending it directly would type every user row as still carrying passwordHash. Re-typing
// the constructor makes the compiler agree with the runtime omit.
const OmittingPrismaClient = PrismaClient as unknown as new (
  options: Prisma.PrismaClientOptions,
) => PrismaClient<never, typeof GLOBAL_OMIT>;

@Injectable()
export class PrismaService
  extends OmittingPrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: new PrismaMariaDb(process.env.DATABASE_URL as string),
      omit: GLOBAL_OMIT,
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

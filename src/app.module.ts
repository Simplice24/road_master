import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CaslModule } from './casl/casl.module';
import { PoliciesGuard } from './casl/policies.guard';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { ExamAttemptsModule } from './exam-attempts/exam-attempts.module';

@Module({
  imports: [
    PrismaModule,
    CaslModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    ExamAttemptsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Order matters: JwtAuthGuard authenticates and attaches request.user first,
    // PoliciesGuard then authorizes against the ability built from that user.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PoliciesGuard },
  ],
})
export class AppModule {}

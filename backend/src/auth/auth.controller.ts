import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PasswordResetService } from './password-reset.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { SubscriptionAccessService } from '../subscriptions/subscription-access.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly access: SubscriptionAccessService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Emails a one-time reset link. The response is identical whether or not the email belongs
   * to an account, so it can't be used to discover registered emails. */
  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    this.passwordReset.requestReset(dto.email, dto.locale);
    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };
  }

  /** Consumes a reset token and sets the new password; every existing session is logged out. */
  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.passwordReset.resetPassword(dto.token, dto.password);
    return { message: 'Your password has been reset. You can now log in.' };
  }

  /** Changes the caller's own password (current password required). Returns a fresh token for
   * this session; every other session is logged out. Like GET /auth/me it has no
   * @RequirePermission — any active user may change their own password. */
  @Post('change-password')
  @HttpCode(200)
  changePassword(
    @CurrentUser() user: Express.User,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  /** The caller's profile, roles, effective permission names and exam-access status.
   * Deliberately has no @RequirePermission: any authenticated, active user must be able to
   * load who they are — even a role with zero permissions — or the frontend can't render
   * anything for them. `access` is the caller's own status, so it needs no permission either. */
  @Get('me')
  async me(@CurrentUser() user: Express.User) {
    const [profile, access] = await Promise.all([
      this.usersService.getAccessProfile(user.id),
      this.access.getAccessSummary(user.id),
    ]);
    return { ...profile, access };
  }
}

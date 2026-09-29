import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
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

  /** The caller's profile, roles and effective permission names. Deliberately has no
   * @RequirePermission: any authenticated, active user must be able to load who they are —
   * even a role with zero permissions — or the frontend can't render anything for them. */
  @Get('me')
  me(@CurrentUser() user: Express.User) {
    return this.usersService.getAccessProfile(user.id);
  }
}

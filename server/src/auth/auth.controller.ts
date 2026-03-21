import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user.type';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from './jwt-auth/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getClientContext(request: Request) {
    return {
      ipAddress: request.ip,
      deviceFingerprint: String(request.headers['x-device-fingerprint'] ?? 'unknown'),
      userAgent: request.headers['user-agent'],
    };
  }

  @Post('send-otp')
  @ApiOperation({ summary: 'Send OTP to a phone number' })
  @ApiBody({ type: SendOtpDto })
  @ApiOkResponse({
    description: 'OTP challenge created successfully',
    schema: {
      example: {
        challengeId: 'bc4b87b5-5628-4786-9000-001122334455',
        message: 'OTP generated successfully.',
        expiresInMinutes: 5,
        resendAvailableAt: '2026-03-21T09:00:00.000Z',
      },
    },
  })
  sendOtp(@Body() dto: SendOtpDto, @Req() request: Request) {
    return this.authService.sendOtp(dto, this.getClientContext(request));
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP challenge and issue JWT tokens' })
  @ApiBody({ type: VerifyOtpDto })
  @ApiOkResponse({
    description: 'OTP verified and session established',
    schema: {
      example: {
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        expiresIn: '7d',
        session: {
          id: '8a60c3f4-f149-4a61-9331-001122334455',
          deviceFingerprint: 'device-web-chrome-01',
          status: 'ACTIVE',
        },
        user: {
          id: '54f515bf-a2da-4b41-bf4f-001122334455',
          phone: '+919876543210',
          role: 'CLIENT',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'OTP is invalid, expired, or already consumed' })
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() request: Request) {
    return this.authService.verifyOtp(dto, this.getClientContext(request));
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token and issue a new session token pair' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({ description: 'Refresh token rotated successfully' })
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refreshSession(dto, this.getClientContext(request));
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Logout the current authenticated session' })
  @ApiOkResponse({ description: 'Current session revoked successfully' })
  logout(@CurrentUser() user: AuthUser) {
    return this.authService.logout(user.userId, user.sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List active and historical sessions for the current user' })
  @ApiOkResponse({ description: 'Session list returned successfully' })
  sessions(@CurrentUser() user: AuthUser) {
    return this.authService.listSessions(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/:id/revoke')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Revoke a specific session for the current user' })
  @ApiParam({ name: 'id', description: 'Session identifier to revoke' })
  @ApiOkResponse({ description: 'Session revoked successfully' })
  revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.authService.revokeSession(user.userId, id, 'user_requested');
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get the current authenticated user profile' })
  @ApiOkResponse({ description: 'Authenticated user returned successfully' })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.getCurrentUser(user.userId);
  }
}

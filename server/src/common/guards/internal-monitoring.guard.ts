import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class InternalMonitoringGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const expectedToken = this.resolveConfiguredToken('METRICS_TOKEN');

    if (!expectedToken) {
      throw new NotFoundException();
    }

    const authorizationHeader = request.headers.authorization;
    const providedToken =
      typeof authorizationHeader === 'string' &&
      authorizationHeader.startsWith('Bearer ')
        ? authorizationHeader.slice(7).trim()
        : undefined;

    if (!providedToken || providedToken !== expectedToken) {
      throw new UnauthorizedException('Internal access token is invalid.');
    }

    return true;
  }

  private resolveConfiguredToken(key: string) {
    const token = this.configService.get<string>(key)?.trim();

    if (!token || token === 'change-me-before-use') {
      return null;
    }

    return token;
  }
}

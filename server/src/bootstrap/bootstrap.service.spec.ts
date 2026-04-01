import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { BootstrapService } from './bootstrap.service';

describe('BootstrapService security', () => {
  let service: BootstrapService;
  let bootstrapToken: string | undefined;

  const prisma = {
    user: {
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'ADMIN_BOOTSTRAP_TOKEN') {
        return bootstrapToken;
      }

      return undefined;
    }),
  };

  const auditService = {
    log: jest.fn(),
  };

  beforeEach(() => {
    bootstrapToken = undefined;
    jest.clearAllMocks();
    service = new BootstrapService(
      prisma as never,
      configService as never,
      auditService as never,
    );
  });

  it('hides bootstrap when no admin bootstrap token is configured', async () => {
    await expect(
      service.bootstrapAdmin({
        token: 'unused',
        name: 'Admin User',
        email: 'admin@example.com',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it('hides bootstrap when the admin bootstrap token is left at the placeholder value', async () => {
    bootstrapToken = 'change-me-before-use';

    await expect(
      service.bootstrapAdmin({
        token: 'change-me-before-use',
        name: 'Admin User',
        email: 'admin@example.com',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it('rejects bootstrap when the provided token is wrong', async () => {
    bootstrapToken = 'expected-bootstrap-token';

    await expect(
      service.bootstrapAdmin({
        token: 'wrong-bootstrap-token',
        name: 'Admin User',
        email: 'admin@example.com',
      }),
    ).rejects.toThrow(new UnauthorizedException('Bootstrap token is invalid.'));

    expect(prisma.user.count).not.toHaveBeenCalled();
  });
});

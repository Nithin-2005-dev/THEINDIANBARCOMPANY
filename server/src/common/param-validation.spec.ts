import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { ClientPortalController } from '../client-portal/client-portal.controller';
import { ClientPortalService } from '../client-portal/client-portal.service';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { RolesGuard } from './guards/roles.guard';
import { ContractsController } from '../contracts/contracts.controller';
import { ContractsService } from '../contracts/contracts.service';
import { LeadsController } from '../leads/leads.controller';
import { LeadsService } from '../leads/leads.service';
import { PaymentsController } from '../payments/payments.controller';
import { PaymentsService } from '../payments/payments.service';
import { ProjectExecutionController } from '../projects/project-execution.controller';
import { ProjectExecutionService } from '../projects/project-execution.service';
import { ProjectsController } from '../projects/projects.controller';
import { ProjectsService } from '../projects/projects.service';

const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const SECOND_UUID = '22222222-2222-2222-2222-222222222222';

function listControllerFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return listControllerFiles(fullPath);
    }

    return fullPath.endsWith('.controller.ts') ? [fullPath] : [];
  });
}

describe('Controller param validation coverage', () => {
  it('does not leave any raw @Param decorators without an explicit pipe', () => {
    const srcRoot = join(__dirname, '..');
    const controllers = listControllerFiles(srcRoot);
    const rawParamUsages = controllers.flatMap((filePath) => {
      const source = readFileSync(filePath, 'utf8');
      const matches = [...source.matchAll(/@Param\(\s*'[^']+'\s*\)/g)];

      return matches.map(
        (match) => `${relative(srcRoot, filePath)} -> ${match[0]}`,
      );
    });

    expect(rawParamUsages).toEqual([]);
  });
});

describe('Param validation smoke tests', () => {
  let app: INestApplication;

  const leadsService = {
    findOneForUser: jest.fn(async (id: string) => ({ id })),
  };
  const projectsService = {
    findOneForUser: jest.fn(async (id: string) => ({ id })),
  };
  const projectExecutionService = {
    addTaskComment: jest.fn(async (projectId: string, taskId: string) => ({
      projectId,
      taskId,
    })),
  };
  const clientPortalService = {
    getThread: jest.fn(async (id: string) => ({ id, messages: [] })),
    sendMessage: jest.fn(async (id: string, dto: { body: string }) => ({
      id,
      body: dto.body,
    })),
  };
  const paymentsService = {
    getProjectHistory: jest.fn(async (projectId: string) => ({
      projectId,
      history: [],
    })),
  };
  const contractsService = {
    listVersions: jest.fn(async (id: string) => ({
      id,
      versions: [],
    })),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        ClientPortalController,
        ContractsController,
        LeadsController,
        PaymentsController,
        ProjectExecutionController,
        ProjectsController,
      ],
      providers: [
        {
          provide: ClientPortalService,
          useValue: clientPortalService,
        },
        {
          provide: ContractsService,
          useValue: contractsService,
        },
        {
          provide: LeadsService,
          useValue: leadsService,
        },
        {
          provide: PaymentsService,
          useValue: paymentsService,
        },
        {
          provide: ProjectExecutionService,
          useValue: projectExecutionService,
        },
        {
          provide: ProjectsService,
          useValue: projectsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => { user?: unknown };
          };
        }) => {
          const request = context.switchToHttp().getRequest();
          request.user = {
            userId: VALID_UUID,
            sessionId: SECOND_UUID,
            role: Role.ADMIN,
          };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an invalid lead UUID before reaching the leads service', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/leads/abc')
      .expect(400);

    expect(response.body.error.statusCode).toBe(400);
    expect(response.body.error.message).toBe(
      'Validation failed (uuid is expected)',
    );
    expect(leadsService.findOneForUser).not.toHaveBeenCalled();
  });

  it('rejects a partial project UUID before reaching the projects service', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/projects/123')
      .expect(400);

    expect(response.body.error.statusCode).toBe(400);
    expect(response.body.error.message).toBe(
      'Validation failed (uuid is expected)',
    );
    expect(projectsService.findOneForUser).not.toHaveBeenCalled();
  });

  it('rejects an invalid nested task UUID before reaching the execution service', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/projects/${VALID_UUID}/tasks/123/comments`)
      .send({ body: 'Need an update.' })
      .expect(400);

    expect(response.body.error.statusCode).toBe(400);
    expect(response.body.error.message).toBe(
      'Validation failed (uuid is expected)',
    );
    expect(projectExecutionService.addTaskComment).not.toHaveBeenCalled();
  });

  it('rejects an invalid chat event UUID before reaching the chat service', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/client-portal/events/abc/thread')
      .expect(400);

    expect(response.body.error.statusCode).toBe(400);
    expect(response.body.error.message).toBe(
      'Validation failed (uuid is expected)',
    );
    expect(clientPortalService.getThread).not.toHaveBeenCalled();
  });

  it('allows a valid UUID through the payments route', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/payments/project/${VALID_UUID}/history`)
      .expect(200);

    expect(response.body).toEqual({
      history: [],
      projectId: VALID_UUID,
    });
    expect(paymentsService.getProjectHistory).toHaveBeenCalledWith(
      VALID_UUID,
      expect.objectContaining({
        role: Role.ADMIN,
        sessionId: SECOND_UUID,
        userId: VALID_UUID,
      }),
    );
  });

  it('allows a valid UUID through the chat route', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/client-portal/events/${VALID_UUID}/messages`)
      .send({ body: 'Confirmed.' })
      .expect(201);

    expect(response.body).toEqual({
      body: 'Confirmed.',
      id: VALID_UUID,
    });
    expect(clientPortalService.sendMessage).toHaveBeenCalledWith(
      VALID_UUID,
      expect.objectContaining({
        body: 'Confirmed.',
      }),
      expect.objectContaining({
        role: Role.ADMIN,
        sessionId: SECOND_UUID,
        userId: VALID_UUID,
      }),
      undefined,
    );
  });

  it('allows a valid UUID through the contracts route', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/contracts/${VALID_UUID}/versions`)
      .expect(200);

    expect(response.body).toEqual({
      id: VALID_UUID,
      versions: [],
    });
    expect(contractsService.listVersions).toHaveBeenCalledWith(
      VALID_UUID,
      expect.objectContaining({
        role: Role.ADMIN,
        sessionId: SECOND_UUID,
        userId: VALID_UUID,
      }),
    );
  });
});

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { CreateProjectDocumentUploadDto } from './dto/create-project-document-upload.dto';
import { CreateProjectTaskCommentDto } from './dto/create-project-task-comment.dto';
import { CreateProjectTaskDto } from './dto/create-project-task.dto';
import { UpdateProjectTaskDto } from './dto/update-project-task.dto';
import { ProjectExecutionService } from './project-execution.service';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectExecutionController {
  constructor(
    private readonly projectExecutionService: ProjectExecutionService,
  ) {}

  @Roles(Role.ADMIN, Role.SALES, Role.OPS, Role.FINANCE, Role.VENDOR)
  @Get(':id/tasks')
  listTasks(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projectExecutionService.listTasks(id, user);
  }

  @Roles(Role.ADMIN, Role.SALES, Role.OPS)
  @Post(':id/tasks')
  createTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProjectTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projectExecutionService.createTask(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.SALES, Role.OPS, Role.FINANCE, Role.VENDOR)
  @Patch(':id/tasks/:taskId')
  updateTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateProjectTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projectExecutionService.updateTask(id, taskId, dto, user);
  }

  @Roles(Role.ADMIN, Role.SALES, Role.OPS, Role.FINANCE, Role.VENDOR)
  @Post(':id/tasks/:taskId/comments')
  addTaskComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateProjectTaskCommentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projectExecutionService.addTaskComment(id, taskId, dto, user);
  }

  @Roles(Role.ADMIN, Role.SALES, Role.OPS, Role.FINANCE, Role.VENDOR)
  @Post(':id/tasks/:taskId/attachment-upload-url')
  createTaskAttachmentUploadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateProjectDocumentUploadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projectExecutionService.createTaskAttachmentUploadUrl(
      id,
      taskId,
      dto,
      user,
    );
  }

  @Roles(Role.ADMIN, Role.SALES, Role.OPS, Role.FINANCE, Role.VENDOR)
  @Get(':id/documents')
  listDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projectExecutionService.listDocuments(id, user);
  }

  @Roles(Role.ADMIN, Role.SALES, Role.OPS, Role.FINANCE, Role.VENDOR)
  @Post(':id/document-upload-url')
  createProjectDocumentUploadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProjectDocumentUploadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projectExecutionService.createProjectDocumentUploadUrl(
      id,
      dto,
      user,
    );
  }
}

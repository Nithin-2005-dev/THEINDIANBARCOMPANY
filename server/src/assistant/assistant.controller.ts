import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { AssistantService } from './assistant.service';
import { CreateAssistantConversationDto } from './dto/create-assistant-conversation.dto';
import { ListAssistantConversationsQueryDto } from './dto/list-assistant-conversations-query.dto';
import { RenameAssistantConversationDto } from './dto/rename-assistant-conversation.dto';
import { SendAssistantMessageDto } from './dto/send-assistant-message.dto';
import { AssistantSuggestionsQueryDto } from './dto/assistant-suggestions-query.dto';
import { TrackAssistantEventDto } from './dto/track-assistant-event.dto';

@Controller('assistant')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SALES, Role.OPS, Role.FINANCE, Role.CLIENT, Role.VENDOR)
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get('conversations')
  conversations(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAssistantConversationsQueryDto,
  ) {
    return this.assistantService.listConversations(
      user,
      query.search,
      query.archived,
    );
  }

  @Post('conversations')
  createConversation(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAssistantConversationDto,
  ) {
    return this.assistantService.createConversation(user, dto);
  }

  @Get('conversations/:id/messages')
  messages(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assistantService.getMessages(user, id);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendAssistantMessageDto,
  ) {
    return this.assistantService.sendMessage(user, id, dto);
  }

  @Post('chat')
  chat(@CurrentUser() user: AuthUser, @Body() dto: SendAssistantMessageDto) {
    return this.assistantService.sendLiveMessage(user, dto);
  }

  @Post('chat/stream')
  async streamChat(
    @CurrentUser() user: AuthUser,
    @Body() dto: SendAssistantMessageDto,
    @Res() response: Response,
  ) {
    const result = await this.assistantService.sendLiveMessage(user, dto);
    const chunks = splitStreamChunks(result.assistantMessage.content);

    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    response.write(
      `event: turn\ndata: ${JSON.stringify({
        userMessage: result.userMessage,
      })}\n\n`,
    );

    for (const chunk of chunks) {
      response.write(
        `event: chunk\ndata: ${JSON.stringify({
          delta: chunk,
        })}\n\n`,
      );
      await sleep(16);
    }

    response.write(`event: complete\ndata: ${JSON.stringify(result)}\n\n`);
    response.end();
  }

  @Post('conversations/:id/messages/stream')
  async streamMessage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendAssistantMessageDto,
    @Res() response: Response,
  ) {
    const result = await this.assistantService.sendMessage(user, id, dto);
    const chunks = splitStreamChunks(result.assistantMessage.content);

    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    response.write(
      `event: turn\ndata: ${JSON.stringify({
        conversation: result.conversation,
        userMessage: result.userMessage,
      })}\n\n`,
    );

    for (const chunk of chunks) {
      response.write(
        `event: chunk\ndata: ${JSON.stringify({
          delta: chunk,
        })}\n\n`,
      );
      await sleep(16);
    }

    response.write(`event: complete\ndata: ${JSON.stringify(result)}\n\n`);
    response.end();
  }

  @Patch('conversations/:id')
  renameConversation(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameAssistantConversationDto,
  ) {
    return this.assistantService.updateConversation(user, id, dto);
  }

  @Delete('conversations/:id')
  deleteConversation(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assistantService.deleteConversation(user, id);
  }

  @Get('suggestions')
  suggestions(
    @CurrentUser() user: AuthUser,
    @Query() query: AssistantSuggestionsQueryDto,
  ) {
    return this.assistantService.getSuggestions(user, query);
  }

  @Post('events')
  trackEvent(
    @CurrentUser() user: AuthUser,
    @Body() dto: TrackAssistantEventDto,
  ) {
    return this.assistantService.trackEvent(user, dto);
  }
}

function splitStreamChunks(content: string) {
  const compact = content.replace(/\r/g, '');
  const chunks = compact.match(/.{1,28}(\s|$)/g) ?? [compact];
  return chunks.map((chunk) => chunk.trimStart()).filter(Boolean);
}

function sleep(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

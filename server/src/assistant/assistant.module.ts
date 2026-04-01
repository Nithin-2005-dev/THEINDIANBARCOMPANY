import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantLlmComposerService } from './assistant-llm-composer.service';
import { AssistantLlmUnderstandingService } from './assistant-llm-understanding.service';
import { AssistantOperationalService } from './assistant-operational.service';
import { AssistantService } from './assistant.service';

@Module({
  controllers: [AssistantController],
  providers: [
    AssistantService,
    AssistantLlmComposerService,
    AssistantLlmUnderstandingService,
    AssistantOperationalService,
  ],
  exports: [AssistantService],
})
export class AssistantModule {}

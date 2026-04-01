import { PartialType } from '@nestjs/swagger';
import { CreateLeadNoteDto } from './create-lead-note.dto';

export class UpdateLeadNoteDto extends PartialType(CreateLeadNoteDto) {}

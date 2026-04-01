import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class AssignLeadStaffDto {
  @ApiProperty({
    description: 'User id of the staff member to assign',
  })
  @IsString()
  userId!: string;

  @ApiProperty({
    enum: AssignmentRole,
    description: 'Assignment role on the lead',
  })
  @IsEnum(AssignmentRole)
  role!: AssignmentRole;

  @ApiPropertyOptional({
    description: 'Optional internal context for the assignment',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { DeleteTeamImageDto } from './dto/delete-team-image.dto';
import { TeamImageSignatureDto } from './dto/team-image-signature.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';
import { TeamService } from './team.service';

@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  listAdminMembers() {
    return this.teamService.listAdminMembers();
  }

  @Post('images/signature')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createImageUploadSignature(@Body() dto: TeamImageSignatureDto) {
    return this.teamService.createImageUploadSignature(dto);
  }

  @Post('images/delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deleteUploadedImage(@Body() dto: DeleteTeamImageDto) {
    return this.teamService.deleteUploadedImage(dto);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createMember(@Body() dto: CreateTeamMemberDto) {
    return this.teamService.createMember(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    return this.teamService.updateMember(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deleteMember(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamService.deleteMember(id);
  }

  @Get()
  listPublicMembers() {
    return this.teamService.listPublicMembers();
  }
}

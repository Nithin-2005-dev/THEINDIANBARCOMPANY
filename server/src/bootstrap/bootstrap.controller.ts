import { Body, Controller, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';
import { BootstrapService } from './bootstrap.service';

@ApiExcludeController()
@Controller('setup')
export class BootstrapController {
  constructor(private readonly bootstrapService: BootstrapService) {}

  @Post('bootstrap-admin')
  bootstrapAdmin(@Body() dto: BootstrapAdminDto) {
    return this.bootstrapService.bootstrapAdmin(dto);
  }
}

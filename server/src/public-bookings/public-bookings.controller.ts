import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreatePublicBookingDto } from './dto/create-public-booking.dto';
import { PublicBookingsService } from './public-bookings.service';

@ApiTags('Public Bookings')
@Controller('public/bookings')
export class PublicBookingsController {
  constructor(private readonly publicBookingsService: PublicBookingsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a public booking request without an existing session',
  })
  @ApiBody({ type: CreatePublicBookingDto })
  create(@Body() dto: CreatePublicBookingDto) {
    return this.publicBookingsService.create(dto);
  }
}

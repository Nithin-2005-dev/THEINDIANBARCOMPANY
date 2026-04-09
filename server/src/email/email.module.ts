import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailDeliveryService } from './email-delivery.service';
import { EmailService } from './email.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [EmailService, EmailDeliveryService],
  exports: [EmailService, EmailDeliveryService],
})
export class EmailModule {}

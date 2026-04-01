import { Global, Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [StorageService, CloudinaryService],
  exports: [StorageService, CloudinaryService],
})
export class StorageModule {}

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly client: S3Client;

  constructor(private readonly configService: ConfigService) {
    this.client = new S3Client({
      region: this.configService.getOrThrow<string>('S3_REGION'),
      endpoint: this.configService.getOrThrow<string>('S3_ENDPOINT'),
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: this.configService.getOrThrow<string>('S3_SECRET_KEY'),
      },
    });
  }

  validateUpload(contentType: string, sizeBytes: number) {
    const maxSize = this.configService.getOrThrow<number>('STORAGE_MAX_FILE_SIZE_BYTES');
    const allowedTypes = ['application/pdf'];

    if (!allowedTypes.includes(contentType)) {
      throw new BadRequestException('Unsupported file type.');
    }

    if (sizeBytes > maxSize) {
      throw new BadRequestException('File exceeds allowed size.');
    }
  }

  async createUploadUrl(key: string, contentType: string) {
    const command = new PutObjectCommand({
      Bucket: this.configService.getOrThrow<string>('S3_BUCKET'),
      Key: key,
      ContentType: contentType,
    });

    const expiresIn = this.configService.getOrThrow<number>('S3_PRESIGNED_URL_TTL_SECONDS');

    return {
      key,
      url: await getSignedUrl(this.client, command, { expiresIn }),
      expiresIn,
    };
  }
}

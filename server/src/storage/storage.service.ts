import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly defaultAttachmentTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
    'application/zip',
  ];

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

  validateUpload(
    contentType: string,
    sizeBytes: number,
    allowedTypes?: string[],
  ) {
    const maxSize = this.configService.getOrThrow<number>(
      'STORAGE_MAX_FILE_SIZE_BYTES',
    );
    const effectiveAllowedTypes = allowedTypes ?? ['application/pdf'];

    if (!effectiveAllowedTypes.includes(contentType)) {
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

    const expiresIn = this.configService.getOrThrow<number>(
      'S3_PRESIGNED_URL_TTL_SECONDS',
    );

    return {
      key,
      url: await getSignedUrl(this.client, command, { expiresIn }),
      fileUrl: this.buildPublicFileUrl(key),
      expiresIn,
    };
  }

  async uploadObject(key: string, contentType: string, body: string | Buffer) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.configService.getOrThrow<string>('S3_BUCKET'),
        Key: key,
        ContentType: contentType,
        Body: body,
      }),
    );

    return {
      key,
      fileUrl: this.buildPublicFileUrl(key),
    };
  }

  async createDownloadUrl(key: string) {
    const command = new GetObjectCommand({
      Bucket: this.configService.getOrThrow<string>('S3_BUCKET'),
      Key: key,
    });

    const expiresIn = this.configService.getOrThrow<number>(
      'S3_PRESIGNED_URL_TTL_SECONDS',
    );

    return {
      key,
      url: await getSignedUrl(this.client, command, { expiresIn }),
      expiresIn,
    };
  }

  getAttachmentAllowedTypes() {
    return [...this.defaultAttachmentTypes];
  }

  buildPublicFileUrl(key: string) {
    const configured = this.configService
      .get<string>('S3_PUBLIC_BASE_URL')
      ?.trim();
    if (configured) {
      return `${configured.replace(/\/$/, '')}/${key}`;
    }

    const endpoint = this.configService
      .getOrThrow<string>('S3_ENDPOINT')
      .replace(/\/$/, '');
    const bucket = this.configService.getOrThrow<string>('S3_BUCKET');
    return `${endpoint}/${bucket}/${key}`;
  }

  extractKeyFromFileUrl(fileUrl: string) {
    const configured = this.configService
      .get<string>('S3_PUBLIC_BASE_URL')
      ?.trim();
    if (configured) {
      const normalizedBase = configured.replace(/\/$/, '');
      if (fileUrl.startsWith(`${normalizedBase}/`)) {
        return decodeURIComponent(fileUrl.slice(normalizedBase.length + 1));
      }
    }

    const endpoint = this.configService
      .getOrThrow<string>('S3_ENDPOINT')
      .replace(/\/$/, '');
    const bucket = this.configService.getOrThrow<string>('S3_BUCKET');
    const defaultBase = `${endpoint}/${bucket}/`;

    if (fileUrl.startsWith(defaultBase)) {
      return decodeURIComponent(fileUrl.slice(defaultBase.length));
    }

    return null;
  }
}

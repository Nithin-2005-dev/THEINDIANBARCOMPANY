import { createHash, randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const TEAM_IMAGE_FOLDER = 'tib/team';

type CloudinaryConfig = {
  apiKey: string;
  apiSecret: string;
  cloudName: string;
};

@Injectable()
export class CloudinaryService {
  private readonly allowedTeamImageTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  constructor(private readonly configService: ConfigService) {}

  createTeamUploadSignature(input: {
    fileName?: string;
    contentType: string;
    sizeBytes: number;
  }) {
    this.validateTeamImage(input.contentType, input.sizeBytes);

    const config = this.getConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = this.buildPublicId(input.fileName);
    const signature = this.createSignature(
      {
        folder: TEAM_IMAGE_FOLDER,
        public_id: publicId,
        timestamp,
      },
      config.apiSecret,
    );

    return {
      apiKey: config.apiKey,
      cloudName: config.cloudName,
      folder: TEAM_IMAGE_FOLDER,
      publicId,
      signature,
      timestamp,
      uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    };
  }

  async deleteImage(publicId: string) {
    const trimmedPublicId = publicId.trim();
    if (!trimmedPublicId) {
      return { result: 'not_found' as const };
    }

    const config = this.getConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.createSignature(
      {
        invalidate: 'true',
        public_id: trimmedPublicId,
        timestamp,
      },
      config.apiSecret,
    );

    const body = new URLSearchParams({
      api_key: config.apiKey,
      invalidate: 'true',
      public_id: trimmedPublicId,
      signature,
      timestamp: String(timestamp),
    });

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );

    if (!response.ok) {
      throw new InternalServerErrorException(
        'Unable to remove the image from Cloudinary.',
      );
    }

    const data = (await response.json()) as { result?: string };
    if (!data.result || (data.result !== 'ok' && data.result !== 'not found')) {
      throw new InternalServerErrorException(
        'Cloudinary returned an unexpected delete response.',
      );
    }

    return {
      result: data.result === 'not found' ? 'not_found' : 'ok',
    } as const;
  }

  buildTeamImageUrl(
    publicId?: string | null,
    sourceUrl?: string | null,
    options: {
      width?: number;
      height?: number;
    } = {},
  ) {
    if (!publicId) {
      return sourceUrl ?? null;
    }

    const { cloudName } = this.getConfig();
    const width = options.width ?? 512;
    const height = options.height ?? 512;
    const version = this.extractVersion(sourceUrl);
    const transforms = `f_auto,q_auto,c_fill,g_auto,w_${width},h_${height}`;
    const encodedPublicId = publicId
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}${
      version ? `/v${version}` : ''
    }/${encodedPublicId}`;
  }

  validateTeamImage(contentType: string, sizeBytes: number) {
    if (!this.allowedTeamImageTypes.includes(contentType)) {
      throw new BadRequestException(
        'Only JPG, PNG, and WebP images are allowed.',
      );
    }

    const maxSize =
      this.configService.get<number>('TEAM_IMAGE_MAX_FILE_SIZE_BYTES') ??
      this.configService.getOrThrow<number>('STORAGE_MAX_FILE_SIZE_BYTES');

    if (sizeBytes > maxSize) {
      throw new BadRequestException('Image exceeds the allowed file size.');
    }
  }

  private buildPublicId(fileName?: string) {
    const baseName = (fileName ?? 'team-member')
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);

    return `${baseName || 'team-member'}-${randomUUID().slice(0, 8)}`;
  }

  private createSignature(
    params: Record<string, number | string | undefined>,
    apiSecret: string,
  ) {
    const payload = Object.entries(params)
      .filter(
        ([, value]) => value !== undefined && value !== null && value !== '',
      )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
  }

  private extractVersion(sourceUrl?: string | null) {
    if (!sourceUrl) {
      return null;
    }

    const match = sourceUrl.match(/\/upload\/(?:[^/]+\/)*v(\d+)\//i);
    return match?.[1] ?? null;
  }

  private getConfig(): CloudinaryConfig {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new InternalServerErrorException(
        'Cloudinary is not configured for team images.',
      );
    }

    return {
      apiKey,
      apiSecret,
      cloudName,
    };
  }
}

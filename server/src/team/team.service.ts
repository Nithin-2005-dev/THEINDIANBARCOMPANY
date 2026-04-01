import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TeamCategory, TeamMember } from '@prisma/client';
import { CloudinaryService } from '../storage/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { DeleteTeamImageDto } from './dto/delete-team-image.dto';
import { TeamImageSignatureDto } from './dto/team-image-signature.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';

const TEAM_CATEGORY_ORDER: Record<TeamCategory, number> = {
  CORE: 0,
  TRUSTEE: 1,
  INFLUENCERS: 2,
};

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async listPublicMembers() {
    const members = await this.prisma.teamMember.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        isVisible: true,
      },
    });

    return this.sortMembers(members).map((member) =>
      this.serializeMember(member, false),
    );
  }

  async listAdminMembers() {
    const members = await this.prisma.teamMember.findMany({
      where: {
        deletedAt: null,
      },
    });

    return this.sortMembers(members).map((member) =>
      this.serializeMember(member, true),
    );
  }

  createImageUploadSignature(dto: TeamImageSignatureDto) {
    return this.cloudinaryService.createTeamUploadSignature(dto);
  }

  async deleteUploadedImage(dto: DeleteTeamImageDto) {
    await this.cloudinaryService.deleteImage(dto.publicId);
    return { success: true };
  }

  async createMember(dto: CreateTeamMemberDto) {
    this.ensurePhotoFields(dto.photoUrl, dto.photoPublicId);

    const member = await this.prisma.teamMember.create({
      data: {
        name: dto.name.trim(),
        designation: dto.designation.trim(),
        category: dto.category,
        bio: this.normalizeText(dto.bio),
        photoUrl: this.normalizeText(dto.photoUrl),
        photoPublicId: this.normalizeText(dto.photoPublicId),
        instagramUrl: this.normalizeUrl(dto.instagramUrl),
        linkedInUrl: this.normalizeUrl(dto.linkedInUrl),
        websiteUrl: this.normalizeUrl(dto.websiteUrl),
        email: this.normalizeEmail(dto.email),
        isActive: dto.isActive ?? true,
        isVisible: dto.isVisible ?? true,
        sortOrder: dto.sortOrder ?? (await this.getNextSortOrder(dto.category)),
      },
    });

    return this.serializeMember(member, true);
  }

  async updateMember(id: string, dto: UpdateTeamMemberDto) {
    const existing = await this.ensureMember(id);
    const nextPhotoUrl = dto.removePhoto
      ? null
      : dto.photoUrl !== undefined
        ? this.normalizeText(dto.photoUrl)
        : existing.photoUrl;
    const nextPhotoPublicId = dto.removePhoto
      ? null
      : dto.photoPublicId !== undefined
        ? this.normalizeText(dto.photoPublicId)
        : existing.photoPublicId;

    if (dto.removePhoto && (dto.photoUrl || dto.photoPublicId)) {
      throw new BadRequestException(
        'Remove the current photo or provide a new photo, not both.',
      );
    }

    if (dto.photoUrl !== undefined || dto.photoPublicId !== undefined) {
      this.ensurePhotoFields(nextPhotoUrl, nextPhotoPublicId);
    }

    const updated = await this.prisma.teamMember.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.designation !== undefined
          ? { designation: dto.designation.trim() }
          : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.bio !== undefined ? { bio: this.normalizeText(dto.bio) } : {}),
        ...(dto.instagramUrl !== undefined
          ? { instagramUrl: this.normalizeUrl(dto.instagramUrl) }
          : {}),
        ...(dto.linkedInUrl !== undefined
          ? { linkedInUrl: this.normalizeUrl(dto.linkedInUrl) }
          : {}),
        ...(dto.websiteUrl !== undefined
          ? { websiteUrl: this.normalizeUrl(dto.websiteUrl) }
          : {}),
        ...(dto.email !== undefined
          ? { email: this.normalizeEmail(dto.email) }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.isVisible !== undefined ? { isVisible: dto.isVisible } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.removePhoto ||
        dto.photoUrl !== undefined ||
        dto.photoPublicId !== undefined
          ? {
              photoUrl: nextPhotoUrl,
              photoPublicId: nextPhotoPublicId,
            }
          : {}),
      },
    });

    if (
      existing.photoPublicId &&
      existing.photoPublicId !== updated.photoPublicId
    ) {
      await this.tryDeleteImage(existing.photoPublicId);
    }

    return this.serializeMember(updated, true);
  }

  async deleteMember(id: string) {
    const existing = await this.ensureMember(id);

    await this.prisma.teamMember.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    if (existing.photoPublicId) {
      await this.tryDeleteImage(existing.photoPublicId);
    }

    return { success: true };
  }

  private async getNextSortOrder(category: TeamCategory) {
    const aggregate = await this.prisma.teamMember.aggregate({
      where: {
        category,
        deletedAt: null,
      },
      _max: {
        sortOrder: true,
      },
    });

    return (aggregate._max.sortOrder ?? -1) + 1;
  }

  private async ensureMember(id: string) {
    const member = await this.prisma.teamMember.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!member) {
      throw new NotFoundException('Team member not found.');
    }

    return member;
  }

  private sortMembers<T extends TeamMember>(members: T[]) {
    return [...members].sort((left, right) => {
      const byCategory =
        TEAM_CATEGORY_ORDER[left.category] -
        TEAM_CATEGORY_ORDER[right.category];
      if (byCategory !== 0) {
        return byCategory;
      }

      const byOrder = left.sortOrder - right.sortOrder;
      if (byOrder !== 0) {
        return byOrder;
      }

      return left.name.localeCompare(right.name);
    });
  }

  private serializeMember(member: TeamMember, includeAdminFields: boolean) {
    const base = {
      id: member.id,
      name: member.name,
      designation: member.designation,
      category: member.category,
      bio: member.bio,
      photoUrl: this.cloudinaryService.buildTeamImageUrl(
        member.photoPublicId,
        member.photoUrl,
      ),
      instagramUrl: member.instagramUrl,
      linkedInUrl: member.linkedInUrl,
      websiteUrl: member.websiteUrl,
      email: member.email,
    };

    if (!includeAdminFields) {
      return base;
    }

    return {
      ...base,
      photoPublicId: member.photoPublicId,
      isActive: member.isActive,
      isVisible: member.isVisible,
      sortOrder: member.sortOrder,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }

  private ensurePhotoFields(
    photoUrl?: string | null,
    photoPublicId?: string | null,
  ) {
    if (Boolean(photoUrl) !== Boolean(photoPublicId)) {
      throw new BadRequestException(
        'Photo URL and Cloudinary public ID must be saved together.',
      );
    }
  }

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private normalizeUrl(value?: string | null) {
    const trimmed = this.normalizeText(value);
    if (!trimmed) {
      return null;
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    return `https://${trimmed}`;
  }

  private normalizeEmail(value?: string | null) {
    const trimmed = this.normalizeText(value);
    return trimmed ? trimmed.toLowerCase() : null;
  }

  private async tryDeleteImage(publicId: string) {
    try {
      await this.cloudinaryService.deleteImage(publicId);
    } catch (error) {
      this.logger.warn(
        `Unable to delete Cloudinary image ${publicId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}

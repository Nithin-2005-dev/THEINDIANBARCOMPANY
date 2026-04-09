import { BadRequestException } from '@nestjs/common';
import { Role, type User } from '@prisma/client';

type ContactIdentityUser = Pick<User, 'id' | 'phone' | 'email' | 'role'>;

export function normalizeEmailContact(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : undefined;
}

export function normalizePhoneContact(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const compact = value.replace(/\s+/g, '');

  if (!compact) {
    return undefined;
  }

  const digitsOnly = compact.replace(/[^\d]/g, '');

  if (/^[6-9]\d{9}$/.test(digitsOnly)) {
    return `+91${digitsOnly}`;
  }

  if (/^91\d{10}$/.test(digitsOnly)) {
    return `+${digitsOnly}`;
  }

  if (/^\+?[1-9]\d{9,14}$/.test(compact)) {
    return compact.startsWith('+') ? compact : `+${compact}`;
  }

  return compact;
}

export function resolveClientUserFromContacts(params: {
  matchingUsers: ContactIdentityUser[];
  phone?: string;
  email?: string;
}) {
  const phoneUser = params.phone
    ? params.matchingUsers.find((user) => user.phone === params.phone) ?? null
    : null;
  const emailUser = params.email
    ? params.matchingUsers.find((user) => user.email === params.email) ?? null
    : null;

  if (phoneUser && emailUser && phoneUser.id !== emailUser.id) {
    throw new BadRequestException(
      'That phone number and email must already belong to the same client account. Please use the linked contact details or call our concierge team.',
    );
  }

  const existingUser = phoneUser ?? emailUser;

  if (!existingUser) {
    return null;
  }

  if (existingUser.role !== Role.CLIENT) {
    throw new BadRequestException(
      'That phone number or email is already linked to a non-client account. Please use a different contact detail or call our concierge team.',
    );
  }

  if (
    params.phone &&
    existingUser.phone &&
    existingUser.phone !== params.phone
  ) {
    throw new BadRequestException(
      'That phone number and email must already belong to the same client account. Please use the linked contact details or call our concierge team.',
    );
  }

  if (
    params.email &&
    existingUser.email &&
    existingUser.email !== params.email
  ) {
    throw new BadRequestException(
      'That phone number and email must already belong to the same client account. Please use the linked contact details or call our concierge team.',
    );
  }

  return existingUser;
}

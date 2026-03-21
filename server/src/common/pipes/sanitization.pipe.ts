import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class SanitizationPipe implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata) {
    return this.sanitize(value);
  }

  private sanitize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (value && typeof value === 'object') {
      return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, child]) => {
        acc[key] = this.sanitize(child);
        return acc;
      }, {});
    }

    if (typeof value === 'string') {
      return value.replace(/\u0000/g, '').trim();
    }

    return value;
  }
}

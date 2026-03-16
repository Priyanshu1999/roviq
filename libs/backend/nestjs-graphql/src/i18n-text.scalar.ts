import { CustomScalar, Scalar } from '@nestjs/graphql';
import { Kind, type ValueNode } from 'graphql';

/**
 * GraphQL scalar for multi-language text stored as `{ locale: text }`.
 * e.g. `{ "en": "Science", "hi": "विज्ञान" }`
 *
 * Behaves like JSON but with a distinct schema type so codegen can map
 * it to `Record<string, string>` instead of `Record<string, unknown>`.
 */
@Scalar('I18nText', () => I18nTextScalar)
export class I18nTextScalar
  implements CustomScalar<Record<string, string>, Record<string, string>>
{
  description = 'Multi-language text stored as { locale: text }';

  parseValue(value: unknown): Record<string, string> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, string>;
    }
    throw new TypeError('I18nText must be a JSON object with locale keys');
  }

  serialize(value: unknown): Record<string, string> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, string>;
    }
    throw new TypeError('I18nText must be a JSON object with locale keys');
  }

  parseLiteral(ast: ValueNode): Record<string, string> {
    if (ast.kind === Kind.OBJECT) {
      const obj: Record<string, string> = {};
      for (const field of ast.fields) {
        if (field.value.kind === Kind.STRING) {
          obj[field.name.value] = field.value.value;
        }
      }
      return obj;
    }
    return {};
  }
}

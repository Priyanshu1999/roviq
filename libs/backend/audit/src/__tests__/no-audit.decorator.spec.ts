import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { NoAudit } from '../decorators/no-audit.decorator';

describe('NoAudit decorator', () => {
  const reflector = new Reflector();

  it('sets metadata on decorated method', () => {
    class TestResolver {
      @NoAudit()
      refreshHealthStatus() {
        return true;
      }
    }

    const result = reflector.get(NoAudit, TestResolver.prototype.refreshHealthStatus);
    expect(result).toBeTruthy();
  });

  it('returns undefined for undecorated method', () => {
    class TestResolver {
      createStudent() {
        return {};
      }
    }

    const result = reflector.get(NoAudit, TestResolver.prototype.createStudent);
    expect(result).toBeUndefined();
  });
});

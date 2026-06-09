import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  it('allows users with all required permissions', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(['documents:validate']) } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const context = createContext(['documents:validate']);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects users without required permissions', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(['settings:manage']) } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const context = createContext(['documents:validate']);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

function createContext(permissions: string[]): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user: { permissions } }) }),
  } as unknown as ExecutionContext;
}

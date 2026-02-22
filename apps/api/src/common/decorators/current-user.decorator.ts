import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayloadUser {
  id: string;
  role?: string;
  sub?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayloadUser | undefined, ctx: ExecutionContext): JwtPayloadUser | unknown => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtPayloadUser }>();
    const user = request.user;
    if (data && user && typeof user === 'object') {
      return user[data];
    }
    return user;
  },
);

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { User } from '../../users/entities/user.entity';

interface RequestWithUser {
  user?: User;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user as User;
  },
);

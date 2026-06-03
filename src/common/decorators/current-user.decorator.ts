import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { Role } from '@prisma/client';

export interface RequestUser {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  studentCode?: string | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
    return request.user;
  },
);

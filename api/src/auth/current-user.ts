import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export interface AuthUser {
  id: string;
  email: string;
}

/** Injecte l'utilisateur résolu par AuthGuard (request.user). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
  return req.user;
});

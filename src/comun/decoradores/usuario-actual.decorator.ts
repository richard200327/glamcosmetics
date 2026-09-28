import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface UsuarioAutenticado {
  idUsuario: number;
  nombreUsuario: string;
  rol: string;
}

export const UsuarioActual = createParamDecorator((_datos: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
  const request = ctx.switchToHttp().getRequest();
  return request.user as UsuarioAutenticado;
});

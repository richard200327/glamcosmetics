import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CLAVE_DE_ROLES } from '../decoradores/roles.decorator';
import { Rol } from '../enums/rol.enum';

// Debe usarse SIEMPRE despues de JwtAuthGuard (JwtAuthGuard llena request.user;
// este guard solo lee ese request.user y lo compara contra los roles requeridos).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<Rol[]>(CLAVE_DE_ROLES, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!rolesRequeridos || rolesRequeridos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const usuario = request.user;

    if (!usuario || !rolesRequeridos.includes(usuario.rol)) {
      throw new ForbiddenException('No tienes permiso para acceder a este recurso.');
    }

    return true;
  }
}

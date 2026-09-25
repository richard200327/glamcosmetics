import { SetMetadata } from '@nestjs/common';
import { Rol } from '../enums/rol.enum';

export const CLAVE_DE_ROLES = 'roles';

// Uso: @Roles(Rol.Administrador) sobre un controlador o un metodo especifico.
// Si un endpoint no tiene este decorador, RolesGuard lo deja pasar (solo exige
// estar autenticado, eso ya lo controla JwtAuthGuard).
export const Roles = (...roles: Rol[]) => SetMetadata(CLAVE_DE_ROLES, roles);

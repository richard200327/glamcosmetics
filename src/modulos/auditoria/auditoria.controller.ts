import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../comun/guards/roles.guard';
import { Roles } from '../../comun/decoradores/roles.decorator';
import { Rol } from '../../comun/enums/rol.enum';
import { AuditoriaService } from './auditoria.service';

// Toda esta zona es exclusiva del Administrador: aqui se ve que hizo cada usuario,
// cuando, y con que resultado.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.Administrador)
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  public obtenerListaDeRegistros(
    @Query('idUsuario') idUsuario?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('metodo') metodo?: string
  ) {
    return this.auditoriaService.obtenerListaDeRegistros({
      idUsuario: idUsuario ? Number(idUsuario) : undefined,
      fechaDesde,
      fechaHasta,
      metodo
    });
  }
}

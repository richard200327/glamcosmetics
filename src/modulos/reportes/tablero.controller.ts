import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuarioActual, UsuarioAutenticado } from '../../comun/decoradores/usuario-actual.decorator';
import { Rol } from '../../comun/enums/rol.enum';
import { ReportesService } from './reportes.service';

@UseGuards(JwtAuthGuard)
@Controller('tablero')
export class TableroController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get()
  public obtenerResumen(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.reportesService.obtenerResumenDelTablero(usuario?.rol === Rol.Administrador);
  }
}

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../comun/guards/roles.guard';
import { Roles } from '../../comun/decoradores/roles.decorator';
import { Rol } from '../../comun/enums/rol.enum';
import { ReportesService } from './reportes.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.Administrador)
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('ventas')
  public generarReporteDeVentas(
    @Query('fechaDesde') fechaDesde: string,
    @Query('fechaHasta') fechaHasta: string,
    @Query('idCliente') idCliente?: string
  ) {
    return this.reportesService.generarReporteDeVentas({
      fechaDesde,
      fechaHasta,
      idCliente: idCliente ? Number(idCliente) : null
    });
  }

  @Get('inventario')
  public generarReporteDeInventario() {
    return this.reportesService.generarReporteDeInventario();
  }
}

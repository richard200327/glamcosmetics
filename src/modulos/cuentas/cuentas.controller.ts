import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CuentasService } from './cuentas.service';

@UseGuards(JwtAuthGuard)
@Controller('cuentas')
export class CuentasController {
  constructor(private readonly cuentasService: CuentasService) {}

  @Get()
  public obtenerListaDeCuentas(
    @Query('idCliente') idCliente?: string,
    @Query('idProveedor') idProveedor?: string,
    @Query('tipoCuenta') tipoCuenta?: string,
    @Query('estado') estado?: string,
    @Query('soloConSaldo') soloConSaldo?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string
  ) {
    const filtraPorTitular = Boolean(idCliente || idProveedor);

    return this.cuentasService.obtenerListaDeCuentas({
      idCliente: idCliente ? Number(idCliente) : undefined,
      idProveedor: idProveedor ? Number(idProveedor) : undefined,
      tipoCuenta: tipoCuenta === 'CXC' || tipoCuenta === 'CXP' ? tipoCuenta : undefined,
      estado: estado || undefined,
      soloConSaldo: soloConSaldo === 'true',
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
      pagina: pagina ? Number(pagina) : undefined,
      limite: limite ? Number(limite) : filtraPorTitular ? 500 : undefined
    });
  }

  @Get('resumen')
  public obtenerResumen() {
    return this.cuentasService.obtenerResumen();
  }

  @Get(':id')
  public obtenerCuentaPorId(@Param('id', ParseIntPipe) id: number) {
    return this.cuentasService.obtenerCuentaPorId(id);
  }
}

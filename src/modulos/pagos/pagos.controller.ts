import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../comun/guards/roles.guard';
import { Roles } from '../../comun/decoradores/roles.decorator';
import { UsuarioActual, UsuarioAutenticado } from '../../comun/decoradores/usuario-actual.decorator';
import { Rol } from '../../comun/enums/rol.enum';
import { ClaveDeIdempotencia } from '../../comun/decoradores/clave-de-idempotencia.decorator';
import { PagosService } from './pagos.service';
import { AnularPagoDto, RegistrarPagoDto } from './dto/pago.dto';

@UseGuards(JwtAuthGuard)
@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Get()
  public obtenerListaDePagos(
    @Query('idCliente') idCliente?: string,
    @Query('idProveedor') idProveedor?: string,
    @Query('tipo') tipo?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string
  ) {
    return this.pagosService.obtenerListaDePagos({
      idCliente: idCliente ? Number(idCliente) : undefined,
      idProveedor: idProveedor ? Number(idProveedor) : undefined,
      tipo: tipo === 'Cobros' || tipo === 'PagosAProveedores' ? tipo : undefined,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
      pagina: pagina ? Number(pagina) : undefined,
      limite: limite ? Number(limite) : undefined
    });
  }

  @Get('por-cuenta/:idCuenta')
  public obtenerAbonosAplicadosACuenta(@Param('idCuenta', ParseIntPipe) idCuenta: number) {
    return this.pagosService.obtenerAbonosAplicadosACuenta(idCuenta);
  }

  @Get(':id')
  public obtenerPagoPorId(@Param('id', ParseIntPipe) id: number) {
    return this.pagosService.obtenerPagoPorId(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Rol.Administrador, Rol.Cajero, Rol.Vendedor)
  @Post()
  public registrarPago(
    @Body() datos: RegistrarPagoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @ClaveDeIdempotencia() claveDeIdempotencia: string | null
  ) {
    return this.pagosService.registrarPago(datos, usuario.idUsuario, claveDeIdempotencia);
  }

  @UseGuards(RolesGuard)
  @Roles(Rol.Administrador, Rol.Cajero)
  @Patch(':id/anular')
  public anularPago(@Param('id', ParseIntPipe) id: number, @Body() datos: AnularPagoDto) {
    return this.pagosService.anularPago(id, datos);
  }
}

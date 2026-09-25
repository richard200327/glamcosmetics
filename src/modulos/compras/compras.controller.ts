import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../comun/guards/roles.guard';
import { Roles } from '../../comun/decoradores/roles.decorator';
import { Rol } from '../../comun/enums/rol.enum';
import { ClaveDeIdempotencia } from '../../comun/decoradores/clave-de-idempotencia.decorator';
import { UsuarioActual, UsuarioAutenticado } from '../../comun/decoradores/usuario-actual.decorator';
import { ComprasService } from './compras.service';
import { AnularCompraDto, CrearCompraDto } from './dto/compra.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.Administrador, Rol.Almacen, Rol.Cajero)
@Controller('compras')
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  @Get()
  public obtenerListaDeCompras(
    @Query('idProveedor') idProveedor?: string,
    @Query('estado') estado?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string
  ) {
    return this.comprasService.obtenerListaDeCompras({
      idProveedor: idProveedor ? Number(idProveedor) : undefined,
      estado: estado || undefined,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
      pagina: pagina ? Number(pagina) : undefined,
      limite: limite ? Number(limite) : undefined
    });
  }

  @Get('costos-por-producto/:idProducto')
  public obtenerUltimosCostosPorProducto(@Param('idProducto', ParseIntPipe) idProducto: number) {
    return this.comprasService.obtenerUltimosCostosPorProducto(idProducto);
  }

  @Get(':id')
  public obtenerCompraPorId(@Param('id', ParseIntPipe) id: number) {
    return this.comprasService.obtenerCompraPorId(id);
  }

  @Roles(Rol.Administrador, Rol.Almacen)
  @Post()
  public crearCompra(
    @Body() datos: CrearCompraDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @ClaveDeIdempotencia() claveDeIdempotencia: string | null
  ) {
    return this.comprasService.crearCompra(datos, usuario.idUsuario, claveDeIdempotencia);
  }

  @Roles(Rol.Administrador)
  @Patch(':id/anular')
  public anularCompra(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: AnularCompraDto,
    @UsuarioActual() usuario: UsuarioAutenticado
  ) {
    return this.comprasService.anularCompra(id, datos, usuario.idUsuario);
  }
}

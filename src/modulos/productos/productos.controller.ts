import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../comun/guards/roles.guard';
import { Roles } from '../../comun/decoradores/roles.decorator';
import { UsuarioActual, UsuarioAutenticado } from '../../comun/decoradores/usuario-actual.decorator';
import { Rol } from '../../comun/enums/rol.enum';
import { ProductosService } from './productos.service';
import { normalizarBusqueda } from '../../comun/utilidades/busqueda';
import { KardexService } from './kardex.service';
import { ActualizarProductoDto, AjustarExistenciaDto, CrearProductoDto } from './dto/producto.dto';

@UseGuards(JwtAuthGuard)
@Controller('productos')
export class ProductosController {
  constructor(
    private readonly productosService: ProductosService,
    private readonly kardexService: KardexService
  ) {}

  @Get()
  public obtenerListaDeProductos(@Query('soloActivos') soloActivos?: string) {
    return this.productosService.obtenerListaDeProductos(soloActivos === 'true');
  }

  @Get('buscar')
  public buscarProductos(@Query('texto') texto?: string, @Query('limite') limite?: string, @Query('soloActivos') soloActivos?: string) {
    return this.productosService.buscarProductos(normalizarBusqueda(texto, limite, '1', 50), soloActivos !== 'false');
  }

  @Get('pagina')
  public obtenerPaginaDeProductos(
    @Query('buscar') buscar?: string,
    @Query('filtro') filtro?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string
  ) {
    return this.productosService.obtenerPaginaDeProductos(normalizarBusqueda(buscar, limite, pagina, 100, 25), filtro ?? 'todos');
  }

  @Get('resumen')
  public obtenerResumenDeProductos() {
    return this.productosService.obtenerResumenDeProductos();
  }

  @Get('movimientos/historial')
  public obtenerListaDeMovimientos(
    @Query('idProducto') idProducto?: string,
    @Query('origen') origen?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string
  ) {
    return this.kardexService.obtenerMovimientos({
      idProducto: idProducto ? Number(idProducto) : undefined,
      origen: origen || undefined,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
      pagina: pagina ? Number(pagina) : undefined,
      limite: limite ? Number(limite) : undefined
    });
  }

  @Get(':id/kardex')
  public obtenerKardex(
    @Param('id', ParseIntPipe) id: number,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string
  ) {
    return this.kardexService.obtenerKardexDeProducto(id, fechaDesde || undefined, fechaHasta || undefined);
  }

  @Get(':id')
  public obtenerProductoPorId(@Param('id', ParseIntPipe) id: number) {
    return this.productosService.obtenerProductoPorId(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Rol.Administrador, Rol.Almacen)
  @Post()
  public crearProducto(@Body() datos: CrearProductoDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.productosService.crearProducto(datos, usuario?.idUsuario ?? null);
  }

  @UseGuards(RolesGuard)
  @Roles(Rol.Administrador, Rol.Almacen)
  @Patch(':id')
  public actualizarProducto(@Param('id', ParseIntPipe) id: number, @Body() datos: ActualizarProductoDto) {
    return this.productosService.actualizarProducto(id, datos);
  }

  @UseGuards(RolesGuard)
  @Roles(Rol.Administrador, Rol.Almacen)
  @Patch(':id/ajuste-de-existencia')
  public ajustarExistencia(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: AjustarExistenciaDto,
    @UsuarioActual() usuario: UsuarioAutenticado
  ) {
    return this.productosService.ajustarExistencia(id, datos, usuario?.idUsuario ?? null);
  }
}

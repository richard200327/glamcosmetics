import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../comun/guards/roles.guard';
import { Roles } from '../../comun/decoradores/roles.decorator';
import { Rol } from '../../comun/enums/rol.enum';
import { UsuarioActual, UsuarioAutenticado } from '../../comun/decoradores/usuario-actual.decorator';
import { TiendaService } from './tienda.service';
import { ArchivoSubido, ProductosDeCatalogoService } from './productos-de-catalogo.service';
import { PedidosWebService } from './pedidos-web.service';
import {
  ActualizarConfiguracionDeTiendaDto,
  ActualizarImagenDto,
  ActualizarVarianteDto,
  ConvertirPedidoWebDto,
  EliminarPedidoWebDto,
  GuardarCategoriaDto,
  GuardarFamiliaDeColorDto,
  GuardarMarcaDto,
  GuardarProductoDeCatalogoDto,
  OrdenarImagenesDto,
  VarianteDto,
  VincularVarianteDto
} from './dto/tienda.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tienda')
export class TiendaController {
  constructor(
    private readonly tiendaService: TiendaService,
    private readonly productosDeCatalogoService: ProductosDeCatalogoService,
    private readonly pedidosWebService: PedidosWebService
  ) {}

  @Get('marcas')
  public obtenerMarcas() {
    return this.tiendaService.obtenerMarcas();
  }

  @Post('marcas')
  @Roles(Rol.Administrador, Rol.Almacen)
  public crearMarca(@Body() datos: GuardarMarcaDto) {
    return this.tiendaService.guardarMarca(datos);
  }

  @Patch('marcas/:id')
  @Roles(Rol.Administrador, Rol.Almacen)
  public actualizarMarca(@Param('id', ParseIntPipe) id: number, @Body() datos: GuardarMarcaDto) {
    return this.tiendaService.guardarMarca(datos, id);
  }

  @Get('categorias')
  public obtenerCategorias() {
    return this.tiendaService.obtenerCategorias();
  }

  @Post('categorias')
  @Roles(Rol.Administrador, Rol.Almacen)
  public crearCategoria(@Body() datos: GuardarCategoriaDto) {
    return this.tiendaService.guardarCategoria(datos);
  }

  @Patch('categorias/:id')
  @Roles(Rol.Administrador, Rol.Almacen)
  public actualizarCategoria(@Param('id', ParseIntPipe) id: number, @Body() datos: GuardarCategoriaDto) {
    return this.tiendaService.guardarCategoria(datos, id);
  }

  @Get('colores')
  public obtenerColores() {
    return this.tiendaService.obtenerFamilias();
  }

  @Post('colores')
  @Roles(Rol.Administrador, Rol.Almacen)
  public crearColor(@Body() datos: GuardarFamiliaDeColorDto) {
    return this.tiendaService.guardarFamilia(datos);
  }

  @Patch('colores/:id')
  @Roles(Rol.Administrador, Rol.Almacen)
  public actualizarColor(@Param('id', ParseIntPipe) id: number, @Body() datos: GuardarFamiliaDeColorDto) {
    return this.tiendaService.guardarFamilia(datos, id);
  }

  @Get('configuracion')
  public obtenerConfiguracion() {
    return this.tiendaService.obtenerConfiguracion();
  }

  @Patch('configuracion')
  @Roles(Rol.Administrador)
  public actualizarConfiguracion(@Body() datos: ActualizarConfiguracionDeTiendaDto) {
    return this.tiendaService.actualizarConfiguracion(datos);
  }

  @Get('productos')
  public obtenerProductos(@Query('buscar') buscar?: string, @Query('pagina') pagina?: string, @Query('limite') limite?: string) {
    return this.productosDeCatalogoService.obtenerLista(buscar ?? '', Math.max(Number(pagina) || 1, 1), Math.min(Math.max(Number(limite) || 24, 1), 100));
  }

  @Get('productos/:id')
  public obtenerProducto(@Param('id', ParseIntPipe) id: number) {
    return this.productosDeCatalogoService.obtenerDetalle(id);
  }

  @Post('productos')
  @Roles(Rol.Administrador, Rol.Almacen)
  public crearProducto(@Body() datos: GuardarProductoDeCatalogoDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.productosDeCatalogoService.crear(datos, usuario.idUsuario);
  }

  @Patch('productos/:id')
  @Roles(Rol.Administrador, Rol.Almacen)
  public actualizarProducto(@Param('id', ParseIntPipe) id: number, @Body() datos: GuardarProductoDeCatalogoDto) {
    return this.productosDeCatalogoService.actualizar(id, datos);
  }

  @Post('productos/:id/variantes')
  @Roles(Rol.Administrador, Rol.Almacen)
  public agregarVariante(@Param('id', ParseIntPipe) id: number, @Body() datos: VarianteDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.productosDeCatalogoService.agregarVariante(id, datos, usuario.idUsuario);
  }

  @Post('productos/:id/vincular')
  @Roles(Rol.Administrador, Rol.Almacen)
  public vincularVariante(@Param('id', ParseIntPipe) id: number, @Body() datos: VincularVarianteDto) {
    return this.productosDeCatalogoService.vincularVariante(id, datos.idProducto);
  }

  @Patch('variantes/:idProducto')
  @Roles(Rol.Administrador, Rol.Almacen)
  public actualizarVariante(@Param('idProducto', ParseIntPipe) idProducto: number, @Body() datos: ActualizarVarianteDto) {
    return this.productosDeCatalogoService.actualizarVariante(idProducto, datos);
  }

  @Delete('variantes/:idProducto')
  @Roles(Rol.Administrador, Rol.Almacen)
  public desvincularVariante(@Param('idProducto', ParseIntPipe) idProducto: number) {
    return this.productosDeCatalogoService.desvincularVariante(idProducto);
  }

  @Post('productos/:id/imagenes')
  @Roles(Rol.Administrador, Rol.Almacen)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'imagen', maxCount: 1 },
        { name: 'miniatura', maxCount: 1 }
      ],
      { limits: { fileSize: 4 * 1024 * 1024, files: 2 } }
    )
  )
  public subirImagen(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() archivos: { imagen?: ArchivoSubido[]; miniatura?: ArchivoSubido[] },
    @Body() datos: { idProducto?: string; textoAlternativo?: string; ancho?: string; alto?: string }
  ) {
    return this.productosDeCatalogoService.subirImagen(id, archivos?.imagen?.[0], archivos?.miniatura?.[0], datos);
  }

  @Post('productos/:id/imagenes/orden')
  @Roles(Rol.Administrador, Rol.Almacen)
  public ordenarImagenes(@Param('id', ParseIntPipe) id: number, @Body() datos: OrdenarImagenesDto) {
    return this.productosDeCatalogoService.ordenarImagenes(id, datos.ids);
  }

  @Patch('imagenes/:id')
  @Roles(Rol.Administrador, Rol.Almacen)
  public actualizarImagen(@Param('id', ParseIntPipe) id: number, @Body() datos: ActualizarImagenDto) {
    return this.productosDeCatalogoService.actualizarImagen(id, datos);
  }

  @Delete('imagenes/:id')
  @Roles(Rol.Administrador, Rol.Almacen)
  public eliminarImagen(@Param('id', ParseIntPipe) id: number) {
    return this.productosDeCatalogoService.eliminarImagen(id);
  }

  @Get('pedidos')
  public obtenerPedidos(@Query('estado') estado?: string, @Query('buscar') buscar?: string) {
    return this.pedidosWebService.obtenerLista(estado ?? 'Pendiente', buscar ?? '');
  }

  @Get('pedidos/resumen')
  public obtenerResumen() {
    return this.pedidosWebService.resumen();
  }

  @Get('pedidos/:id')
  public obtenerPedido(@Param('id', ParseIntPipe) id: number) {
    return this.pedidosWebService.obtenerPorId(id);
  }

  @Get('pedidos/:id/evaluacion')
  public evaluarPedido(@Param('id', ParseIntPipe) id: number) {
    return this.pedidosWebService.evaluar(id);
  }

  @Post('pedidos/:id/convertir')
  @Roles(Rol.Administrador, Rol.Cajero, Rol.Vendedor)
  public convertirPedido(@Param('id', ParseIntPipe) id: number, @Body() datos: ConvertirPedidoWebDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.pedidosWebService.convertir(id, datos, usuario.idUsuario);
  }

  @Patch('pedidos/:id/eliminar')
  @Roles(Rol.Administrador, Rol.Cajero, Rol.Vendedor)
  public eliminarPedido(@Param('id', ParseIntPipe) id: number, @Body() datos: EliminarPedidoWebDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.pedidosWebService.eliminar(id, datos, usuario.idUsuario);
  }
}

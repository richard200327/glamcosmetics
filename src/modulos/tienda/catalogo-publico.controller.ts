import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ClaveDeIdempotencia } from '../../comun/decoradores/clave-de-idempotencia.decorator';
import { CatalogoPublicoService } from './catalogo-publico.service';
import { ProductosDeCatalogoService } from './productos-de-catalogo.service';
import { PedidosWebService } from './pedidos-web.service';
import { CrearPedidoWebDto } from './dto/tienda.dto';
import { LimitadorDePedidosGuard } from './limitador.guard';

@Controller('catalogo')
export class CatalogoPublicoController {
  constructor(
    private readonly catalogoPublicoService: CatalogoPublicoService,
    private readonly productosDeCatalogoService: ProductosDeCatalogoService,
    private readonly pedidosWebService: PedidosWebService
  ) {}

  @Get('tienda')
  public obtenerTienda() {
    return this.catalogoPublicoService.obtenerTienda();
  }

  @Get('filtros')
  public obtenerFiltros() {
    return this.catalogoPublicoService.obtenerFiltros();
  }

  @Get('productos')
  public obtenerProductos(
    @Query('buscar') buscar?: string,
    @Query('marca') marca?: string,
    @Query('categoria') categoria?: string,
    @Query('color') color?: string,
    @Query('orden') orden?: string,
    @Query('destacados') destacados?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string
  ) {
    return this.catalogoPublicoService.obtenerProductos({
      buscar: (buscar ?? '').slice(0, 80),
      marca,
      categoria,
      color: color ? Number(color) || undefined : undefined,
      orden,
      soloDestacados: destacados === 'true',
      pagina: Math.max(Number(pagina) || 1, 1),
      limite: Math.min(Math.max(Number(limite) || 24, 1), 60)
    });
  }

  @Get('productos/:slug')
  public obtenerProducto(@Param('slug') slug: string) {
    return this.catalogoPublicoService.obtenerProductoPorSlug(slug.slice(0, 170));
  }

  @Get('imagenes/:id')
  public async obtenerImagen(@Param('id', ParseIntPipe) id: number, @Res() respuesta: Response) {
    return this.enviarImagen(id, false, respuesta);
  }

  @Get('imagenes/:id/miniatura')
  public async obtenerMiniatura(@Param('id', ParseIntPipe) id: number, @Res() respuesta: Response) {
    return this.enviarImagen(id, true, respuesta);
  }

  @Post('pedidos')
  @UseGuards(LimitadorDePedidosGuard)
  public crearPedido(@Body() datos: CrearPedidoWebDto, @ClaveDeIdempotencia() clave: string | null, @Req() peticion: Request) {
    const ip = String(peticion.headers['x-forwarded-for'] ?? peticion.ip ?? '').split(',')[0].trim() || null;
    return this.pedidosWebService.crear(datos, clave, ip);
  }

  @Get('pedidos/:codigo')
  public obtenerPedido(@Param('codigo') codigo: string) {
    return this.pedidosWebService.obtenerPorCodigo(codigo.slice(0, 20));
  }

  private async enviarImagen(id: number, miniatura: boolean, respuesta: Response) {
    const imagen = await this.productosDeCatalogoService.obtenerContenidoDeImagen(id, miniatura);
    if (imagen === null) {
      throw new NotFoundException('Imagen no encontrada.');
    }
    respuesta.setHeader('Content-Type', imagen.tipoMime);
    respuesta.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    respuesta.setHeader('Content-Length', String(imagen.contenido.length));
    respuesta.end(imagen.contenido);
  }
}

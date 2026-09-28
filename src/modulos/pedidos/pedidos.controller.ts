import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../comun/guards/roles.guard';
import { Roles } from '../../comun/decoradores/roles.decorator';
import { Rol } from '../../comun/enums/rol.enum';
import { ClaveDeIdempotencia } from '../../comun/decoradores/clave-de-idempotencia.decorator';
import { UsuarioActual, UsuarioAutenticado } from '../../comun/decoradores/usuario-actual.decorator';
import { PedidosService } from './pedidos.service';
import { AnularPedidoDto, CrearPedidoDto, EvaluarLineasDto } from './dto/pedido.dto';

@UseGuards(JwtAuthGuard)
@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Post('evaluar')
  public evaluarLineas(@Body() datos: EvaluarLineasDto) {
    return this.pedidosService.evaluarLineas(datos);
  }

  @Get()
  public obtenerListaDePedidos(
    @Query('idCliente') idCliente?: string,
    @Query('estado') estado?: string,
    @Query('tipoOperacion') tipoOperacion?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string
  ) {
    return this.pedidosService.obtenerListaDePedidos({
      idCliente: idCliente ? Number(idCliente) : undefined,
      estado: estado || undefined,
      tipoOperacion: tipoOperacion || undefined,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
      pagina: pagina ? Number(pagina) : undefined,
      limite: limite ? Number(limite) : undefined
    });
  }

  @Get(':id')
  public obtenerPedidoPorId(@Param('id', ParseIntPipe) id: number) {
    return this.pedidosService.obtenerPedidoPorId(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Rol.Administrador, Rol.Vendedor, Rol.Cajero)
  @Post()
  public crearPedido(
    @Body() datos: CrearPedidoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @ClaveDeIdempotencia() claveDeIdempotencia: string | null
  ) {
    return this.pedidosService.crearPedido(datos, usuario.idUsuario, claveDeIdempotencia);
  }

  @UseGuards(RolesGuard)
  @Roles(Rol.Administrador, Rol.Cajero, Rol.Vendedor)
  @Patch(':id/anular')
  public anularPedido(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: AnularPedidoDto,
    @UsuarioActual() usuario: UsuarioAutenticado
  ) {
    return this.pedidosService.anularPedido(id, datos?.motivo, usuario.idUsuario);
  }
}

import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { normalizarBusqueda } from '../../comun/utilidades/busqueda';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClientesService } from './clientes.service';
import { ActualizarClienteDto, CrearClienteDto } from './dto/cliente.dto';

@UseGuards(JwtAuthGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  public obtenerListaDeClientes() {
    return this.clientesService.obtenerListaDeClientes();
  }

  @Get('buscar')
  public buscarClientes(@Query('texto') texto?: string, @Query('limite') limite?: string, @Query('soloActivos') soloActivos?: string) {
    return this.clientesService.buscarClientes(normalizarBusqueda(texto, limite, '1', 50), soloActivos !== 'false');
  }

  @Get('pagina')
  public obtenerPaginaDeClientes(
    @Query('buscar') buscar?: string,
    @Query('estado') estado?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string
  ) {
    return this.clientesService.obtenerPaginaDeClientes(normalizarBusqueda(buscar, limite, pagina, 100, 25), estado ?? 'todos');
  }

  @Get(':id')
  public obtenerClientePorId(@Param('id', ParseIntPipe) id: number) {
    return this.clientesService.obtenerClientePorId(id);
  }

  @Post()
  public crearCliente(@Body() datos: CrearClienteDto) {
    return this.clientesService.crearCliente(datos);
  }

  @Patch(':id')
  public actualizarCliente(@Param('id', ParseIntPipe) id: number, @Body() datos: ActualizarClienteDto) {
    return this.clientesService.actualizarCliente(id, datos);
  }
}

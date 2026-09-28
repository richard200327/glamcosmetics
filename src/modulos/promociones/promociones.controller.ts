import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../comun/guards/roles.guard';
import { Roles } from '../../comun/decoradores/roles.decorator';
import { Rol } from '../../comun/enums/rol.enum';
import { PromocionesService } from './promociones.service';
import { ActualizarPromocionDto, CrearPromocionDto } from './dto/promocion.dto';
import { obtenerFechaLocalDeHoy } from '../../comun/utilidades/fechas';

class GuardarReglaDeCantidadDto {
  @IsInt({ each: true })
  idsDeProductos: number[];

  @IsInt()
  @Min(1)
  cantidadMinima: number;

  @IsIn(['Porcentaje', 'MontoFijo'])
  tipoDescuento: 'Porcentaje' | 'MontoFijo';

  @IsNumber()
  @Min(0)
  valorDescuento: number;
}

class AgregarReglaDePrecioEspecialDto {
  @IsInt()
  idProducto: number;

  @IsNumber()
  @Min(0)
  precioEspecial: number;
}

class GuardarReglaDeMontoPedidoDto {
  @IsNumber()
  @Min(0)
  montoMinimoPedido: number;

  @IsIn(['DescuentoPorcentaje', 'ProductoGratis'])
  tipoBeneficio: 'DescuentoPorcentaje' | 'ProductoGratis';

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorDescuento?: number | null;

  @IsOptional()
  @IsInt()
  idProductoRegalo?: number | null;
}

@UseGuards(JwtAuthGuard)
@Controller('promociones')
export class PromocionesController {
  constructor(private readonly promocionesService: PromocionesService) {}

  // Cualquier rol autenticado puede consultar promociones (Vendedor las necesita
  // para saber que aplica al armar un pedido).
  @Get()
  public obtenerListaDePromociones() {
    return this.promocionesService.obtenerListaDePromociones();
  }

  @Get('vigentes')
  public obtenerPromocionesVigentes(@Query('fecha') fecha?: string) {
    const fechaConsultada = fecha ?? obtenerFechaLocalDeHoy();
    return this.promocionesService.obtenerPromocionesVigentes(fechaConsultada);
  }

  @Get(':id')
  public obtenerPromocionPorId(@Param('id', ParseIntPipe) id: number) {
    return this.promocionesService.obtenerPromocionPorId(id);
  }

  // Crear/editar/desactivar promociones es una decision comercial: solo Administrador.
  @UseGuards(RolesGuard)
  @Roles(Rol.Administrador)
  @Post()
  public crearPromocion(@Body() datos: CrearPromocionDto) {
    return this.promocionesService.crearPromocion(datos);
  }

  @UseGuards(RolesGuard)
  @Roles(Rol.Administrador)
  @Patch(':id')
  public actualizarPromocion(@Param('id', ParseIntPipe) id: number, @Body() datos: ActualizarPromocionDto) {
    return this.promocionesService.actualizarPromocion(id, datos);
  }

  @UseGuards(RolesGuard)
  @Roles(Rol.Administrador)
  @Patch(':id/desactivar')
  public desactivarPromocion(@Param('id', ParseIntPipe) id: number) {
    return this.promocionesService.desactivarPromocion(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Rol.Administrador)
  @Patch(':id/regla-de-cantidad')
  public guardarReglaDeCantidad(@Param('id', ParseIntPipe) id: number, @Body() datos: GuardarReglaDeCantidadDto) {
    return this.promocionesService.guardarReglaDeCantidad(
      id,
      datos.idsDeProductos,
      datos.cantidadMinima,
      datos.tipoDescuento,
      datos.valorDescuento
    );
  }

  @UseGuards(RolesGuard)
  @Roles(Rol.Administrador)
  @Post(':id/reglas-de-precio-especial')
  public agregarReglaDePrecioEspecial(@Param('id', ParseIntPipe) id: number, @Body() datos: AgregarReglaDePrecioEspecialDto) {
    return this.promocionesService.agregarReglaDePrecioEspecial(id, datos.idProducto, datos.precioEspecial);
  }

  @UseGuards(RolesGuard)
  @Roles(Rol.Administrador)
  @Delete('reglas-de-precio-especial/:idRegla')
  public eliminarReglaDePrecioEspecial(@Param('idRegla', ParseIntPipe) idRegla: number) {
    return this.promocionesService.eliminarReglaDePrecioEspecial(idRegla);
  }

  @UseGuards(RolesGuard)
  @Roles(Rol.Administrador)
  @Patch(':id/regla-de-monto-pedido')
  public guardarReglaDeMontoPedido(@Param('id', ParseIntPipe) id: number, @Body() datos: GuardarReglaDeMontoPedidoDto) {
    return this.promocionesService.guardarReglaDeMontoPedido(
      id,
      datos.montoMinimoPedido,
      datos.tipoBeneficio,
      datos.valorDescuento ?? null,
      datos.idProductoRegalo ?? null
    );
  }
}

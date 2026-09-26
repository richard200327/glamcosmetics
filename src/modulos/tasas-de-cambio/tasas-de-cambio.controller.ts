import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsDateString, IsNumber, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../comun/guards/roles.guard';
import { Roles } from '../../comun/decoradores/roles.decorator';
import { Rol } from '../../comun/enums/rol.enum';
import { TasasDeCambioService } from './tasas-de-cambio.service';
import { obtenerFechaLocalDeHoy } from '../../comun/utilidades/fechas';

class RegistrarTasaDto {
  @IsDateString()
  fecha: string;

  @IsNumber()
  @Min(0)
  valorTasaBcv: number;

  @IsNumber()
  @Min(0)
  valorTasaBinance: number;
}

@UseGuards(JwtAuthGuard)
@Controller('tasas-de-cambio')
export class TasasDeCambioController {
  constructor(private readonly tasasDeCambioService: TasasDeCambioService) {}

  // Consultar la tasa es necesario para cualquier rol que arme un pedido o un pago.
  @Get()
  public obtenerListaDeTasas() {
    return this.tasasDeCambioService.obtenerListaDeTasas();
  }

  @Get('vigente')
  public async obtenerTasaVigente(@Query('fecha') fecha?: string) {
    const fechaConsultada = fecha ?? obtenerFechaLocalDeHoy();
    try {
      return await this.tasasDeCambioService.obtenerTasaVigenteParaFecha(fechaConsultada);
    } catch {
      return null;
    }
  }

  // Registrar la tasa del dia es una decision administrativa/financiera.
  @UseGuards(RolesGuard)
  @Roles(Rol.Administrador)
  @Post()
  public registrarTasa(@Body() datos: RegistrarTasaDto) {
    return this.tasasDeCambioService.registrarOActualizarTasaDelDia(datos);
  }

  // Trae automaticamente la tasa oficial (BCV) y paralelo (Binance) de dolarapi.com
  // y las guarda como la tasa del dia. Evita tener que escribirlas a mano cada dia.
  @UseGuards(RolesGuard)
  @Roles(Rol.Administrador)
  @Post('sincronizar')
  public sincronizarDesdeDolarApi() {
    return this.tasasDeCambioService.sincronizarTasaDelDiaDesdeDolarApi();
  }
}

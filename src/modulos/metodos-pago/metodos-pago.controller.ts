import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MetodosPagoService } from './metodos-pago.service';

@UseGuards(JwtAuthGuard)
@Controller('metodos-pago')
export class MetodosPagoController {
  constructor(private readonly metodosPagoService: MetodosPagoService) {}

  @Get()
  public obtenerListaDeMetodosDePago() {
    return this.metodosPagoService.obtenerListaDeMetodosDePago();
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetodoPago } from '../../comun/entidades';

@Injectable()
export class MetodosPagoService {
  constructor(
    @InjectRepository(MetodoPago)
    private readonly repositorioDeMetodosDePago: Repository<MetodoPago>
  ) {}

  public async obtenerListaDeMetodosDePago(): Promise<MetodoPago[]> {
    return this.repositorioDeMetodosDePago.find({ where: { activo: true }, order: { nombre: 'ASC' } });
  }
}

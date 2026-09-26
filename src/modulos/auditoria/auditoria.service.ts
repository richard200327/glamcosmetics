import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegistroDeAuditoria } from '../../comun/entidades';

export interface FiltrosDeAuditoria {
  idUsuario?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  metodo?: string;
}

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(RegistroDeAuditoria)
    private readonly repositorioDeAuditoria: Repository<RegistroDeAuditoria>
  ) {}

  // Se llama desde AuditoriaInterceptor, "fire and forget": si el log falla, nunca
  // debe tumbar la peticion original del usuario.
  public async registrarAccion(datos: {
    idUsuario: number | null;
    nombreDeUsuario: string | null;
    rol: string | null;
    metodo: string;
    ruta: string;
    codigoDeRespuesta: number;
    resumenDelCuerpo: string | null;
    direccionIp: string | null;
  }): Promise<void> {
    try {
      const registro = this.repositorioDeAuditoria.create(datos);
      await this.repositorioDeAuditoria.save(registro);
    } catch {
      // Intencionalmente silencioso: un fallo al auditar no debe afectar la respuesta
      // de la operacion real que el usuario esta esperando.
    }
  }

  public async obtenerListaDeRegistros(filtros: FiltrosDeAuditoria): Promise<RegistroDeAuditoria[]> {
    const consulta = this.repositorioDeAuditoria
      .createQueryBuilder('registro')
      .leftJoinAndSelect('registro.usuario', 'usuario')
      .orderBy('registro.fecha', 'DESC')
      .take(500);

    if (filtros.idUsuario) {
      consulta.andWhere('registro.idUsuario = :idUsuario', { idUsuario: filtros.idUsuario });
    }
    if (filtros.fechaDesde) {
      consulta.andWhere('registro.fecha >= :fechaDesde', { fechaDesde: filtros.fechaDesde });
    }
    if (filtros.fechaHasta) {
      // Ver nota en ReportesService: Fecha es DATETIME completo, fechaHasta llega
      // como solo la fecha. Se extiende a fin de dia para no excluir registros
      // ocurridos despues de medianoche del ultimo dia del rango.
      consulta.andWhere('registro.fecha <= :fechaHasta', { fechaHasta: `${filtros.fechaHasta} 23:59:59` });
    }
    if (filtros.metodo) {
      consulta.andWhere('registro.metodo = :metodo', { metodo: filtros.metodo });
    }

    return consulta.getMany();
  }
}

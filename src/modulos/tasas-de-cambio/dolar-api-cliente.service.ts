import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { LoggerDeAplicacion } from '../../comun/logger/logger-de-aplicacion';

export interface CotizacionDolarApi {
  moneda: string;
  fuente: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fechaActualizacion: string;
}

const URL_DOLARES_VENEZUELA = 'https://ve.dolarapi.com/v1/dolares';

// Cliente aislado en su propia clase (en vez de llamar fetch directamente desde
// TasasDeCambioService) para que se pueda mockear facilmente en tests unitarios sin
// necesidad de red real, y para tener un unico lugar donde cambiar de proveedor de
// tasas si dolarapi.com cambia de contrato o queda fuera de servicio.
@Injectable()
export class DolarApiClienteService {
  private readonly logger = new LoggerDeAplicacion('DolarApiClienteService');

  public async obtenerCotizacionesDeVenezuela(): Promise<CotizacionDolarApi[]> {
    try {
      // fetch global de Node 18+, sin necesidad de agregar axios como dependencia.
      const respuesta = await fetch(URL_DOLARES_VENEZUELA, {
        signal: AbortSignal.timeout(8000)
      });

      if (!respuesta.ok) {
        throw new Error(`dolarapi.com respondio con codigo ${respuesta.status}`);
      }

      const cuerpo = (await respuesta.json()) as CotizacionDolarApi[];

      if (!Array.isArray(cuerpo)) {
        throw new Error('La respuesta de dolarapi.com no tiene el formato esperado (se esperaba un array).');
      }

      return cuerpo;
    } catch (error) {
      this.logger.error('No se pudo consultar dolarapi.com', error);
      throw new ServiceUnavailableException(
        'No se pudo consultar la tasa de cambio en dolarapi.com. Intenta de nuevo en unos minutos, o registra la tasa manualmente.'
      );
    }
  }
}

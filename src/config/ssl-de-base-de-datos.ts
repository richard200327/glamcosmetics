import { existsSync, readFileSync } from 'fs';
import { isAbsolute, join } from 'path';

export interface OpcionesSsl {
  ca?: string;
  minVersion: 'TLSv1.2';
  rejectUnauthorized: boolean;
}

export function construirSslDeBaseDeDatos(obtener: (clave: string) => string | undefined): OpcionesSsl | undefined {
  const activo = (obtener('DB_SSL') ?? '').trim().toLowerCase();
  const rutaDelCa = (obtener('DB_SSL_CA') ?? '').trim();
  if (activo !== 'true' && activo !== '1' && rutaDelCa === '') {
    return undefined;
  }
  const opciones: OpcionesSsl = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: (obtener('DB_SSL_REJECT_UNAUTHORIZED') ?? 'true').trim().toLowerCase() !== 'false'
  };
  if (rutaDelCa !== '') {
    const candidatas = isAbsolute(rutaDelCa) ? [rutaDelCa] : [join(process.cwd(), rutaDelCa), join(__dirname, '..', '..', rutaDelCa)];
    const encontrada = candidatas.find((ruta) => existsSync(ruta));
    if (!encontrada) {
      throw new Error(`No se encontro el certificado CA de la base de datos en "${rutaDelCa}". Revisa DB_SSL_CA en el .env.`);
    }
    opciones.ca = readFileSync(encontrada, 'utf8');
  }
  return opciones;
}

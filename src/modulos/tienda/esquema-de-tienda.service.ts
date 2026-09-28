import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LoggerDeAplicacion } from '../../comun/logger/logger-de-aplicacion';

const COLUMNAS: { tabla: string; columna: string; definicion: string }[] = [
  { tabla: 'ConfiguracionDeTienda', columna: 'PaisPorDefecto', definicion: "VARCHAR(2) NOT NULL DEFAULT 'VE'" },
  { tabla: 'ConfiguracionDeTienda', columna: 'Textos', definicion: 'MEDIUMTEXT NULL' },
  { tabla: 'ConfiguracionDeTienda', columna: 'MetodosDePago', definicion: 'MEDIUMTEXT NULL' }
];

@Injectable()
export class EsquemaDeTiendaService implements OnModuleInit {
  private readonly logger = new LoggerDeAplicacion('EsquemaDeTiendaService');

  constructor(private readonly dataSource: DataSource) {}

  public async onModuleInit(): Promise<void> {
    for (const { tabla, columna, definicion } of COLUMNAS) {
      const [fila] = await this.dataSource.query(
        'SELECT COUNT(*) AS Cantidad FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        [tabla, columna]
      );
      if (Number(fila?.Cantidad ?? 0) === 0) {
        await this.dataSource.query(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
        this.logger.log('Columna agregada', { tabla, columna });
      }
    }
  }
}

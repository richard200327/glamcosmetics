import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { transformadorDecimal } from '../transformadores/decimal.transformer';

@Entity({ name: 'TasaDeCambio' })
@Unique('UQ_TasaDeCambio_Fecha', ['fecha'])
export class TasaDeCambio {
  @PrimaryGeneratedColumn({ name: 'IdTasa' })
  idTasa: number;

  @Column({ name: 'Fecha', type: 'date' })
  fecha: string;

  @Column({ name: 'ValorTasaBcv', type: 'decimal', precision: 18, scale: 4 , transformer: transformadorDecimal})
  valorTasaBcv: number;

  @Column({ name: 'ValorTasaBinance', type: 'decimal', precision: 18, scale: 4 , transformer: transformadorDecimal})
  valorTasaBinance: number;

  @CreateDateColumn({ name: 'FechaDeRegistro', type: 'datetime' })
  fechaDeRegistro: Date;
}

import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RegistroPago } from './registro-pago.entity';
import { CuentaPorCobrarPagar } from './cuenta-por-cobrar-pagar.entity';
import { MetodoPago } from './metodo-pago.entity';
import { transformadorDecimal } from '../transformadores/decimal.transformer';

@Entity({ name: 'DetallePago' })
export class DetallePago {
  @PrimaryGeneratedColumn({ name: 'IdDetallePago' })
  idDetallePago: number;

  @Column({ name: 'IdPago' })
  idPago: number;

  @ManyToOne(() => RegistroPago, (pago) => pago.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'IdPago' })
  pago: RegistroPago;

  @Column({ name: 'IdCuenta' })
  idCuenta: number;

  @ManyToOne(() => CuentaPorCobrarPagar, { eager: true })
  @JoinColumn({ name: 'IdCuenta' })
  cuenta: CuentaPorCobrarPagar;

  @Column({ name: 'IdMetodoPago' })
  idMetodoPago: number;

  @ManyToOne(() => MetodoPago, { eager: true })
  @JoinColumn({ name: 'IdMetodoPago' })
  metodoPago: MetodoPago;

  @Column({ name: 'MontoAplicado', type: 'decimal', precision: 18, scale: 2 , transformer: transformadorDecimal})
  montoAplicado: number;

  @Column({ name: 'MontoPagadoEnBolivares', type: 'decimal', precision: 18, scale: 2 , transformer: transformadorDecimal})
  montoPagadoEnBolivares: number;
}

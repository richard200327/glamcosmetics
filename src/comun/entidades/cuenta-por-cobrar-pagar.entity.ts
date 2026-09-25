import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Pedido } from './pedido.entity';
import { Cliente } from './cliente.entity';
import { Proveedor } from './proveedor.entity';
import { Compra } from './compra.entity';
import { transformadorDecimal } from '../transformadores/decimal.transformer';

export type TipoDeCuenta = 'CXC' | 'CXP';
export type EstadoDeLaCuenta = 'Pendiente' | 'Pagada' | 'Vencida' | 'Parcial' | 'Anulada';

@Entity({ name: 'CuentaPorCobrarPagar' })
export class CuentaPorCobrarPagar {
  @PrimaryGeneratedColumn({ name: 'IdCuenta' })
  idCuenta: number;

  @Column({ name: 'IdPedido', nullable: true })
  idPedido: number | null;

  @ManyToOne(() => Pedido, { eager: false, nullable: true })
  @JoinColumn({ name: 'IdPedido' })
  pedido: Pedido | null;

  @Column({ name: 'IdCompra', nullable: true })
  idCompra: number | null;

  @ManyToOne(() => Compra, { eager: false, nullable: true })
  @JoinColumn({ name: 'IdCompra' })
  compra: Compra | null;

  @Column({ name: 'IdProveedor', nullable: true })
  idProveedor: number | null;

  @ManyToOne(() => Proveedor, { eager: true, nullable: true })
  @JoinColumn({ name: 'IdProveedor' })
  proveedor: Proveedor | null;

  @Column({ name: 'IdCliente', nullable: true })
  idCliente: number | null;

  @ManyToOne(() => Cliente, { eager: true, nullable: true })
  @JoinColumn({ name: 'IdCliente' })
  cliente: Cliente | null;

  @Column({ name: 'TipoCuenta', type: 'varchar', length: 10 })
  tipoCuenta: TipoDeCuenta;

  @Column({ name: 'MontoOriginal', type: 'decimal', precision: 18, scale: 2 , transformer: transformadorDecimal})
  montoOriginal: number;

  @Column({ name: 'SaldoPendiente', type: 'decimal', precision: 18, scale: 2 , transformer: transformadorDecimal})
  saldoPendiente: number;

  @CreateDateColumn({ name: 'FechaEmision', type: 'datetime' })
  fechaEmision: Date;

  @Column({ name: 'FechaVencimiento', type: 'datetime', nullable: true })
  fechaVencimiento: Date | null;

  @Column({ name: 'Estado', type: 'varchar', length: 20 })
  estado: EstadoDeLaCuenta;
}

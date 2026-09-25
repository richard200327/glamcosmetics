import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from './usuario.entity';
import { Cliente } from './cliente.entity';
import { Proveedor } from './proveedor.entity';
import { DetallePago } from './detalle-pago.entity';
import { transformadorDecimal } from '../transformadores/decimal.transformer';

@Entity({ name: 'RegistroPago' })
export class RegistroPago {
  @PrimaryGeneratedColumn({ name: 'IdPago' })
  idPago: number;

  // Si el cliente reintenta el POST /pagos (ej: por timeout), esta clave (mandada en
  // el header X-Idempotency-Key) evita registrar un segundo pago: ver PagosService.registrarPago.
  @Column({ name: 'ClaveDeIdempotencia', type: 'varchar', length: 100, nullable: true, unique: true })
  claveDeIdempotencia: string | null;

  @Column({ name: 'IdUsuario' })
  idUsuario: number;

  @ManyToOne(() => Usuario, { eager: true })
  @JoinColumn({ name: 'IdUsuario' })
  usuario: Usuario;

  @Column({ name: 'IdCliente', nullable: true })
  idCliente: number | null;

  @ManyToOne(() => Cliente, { eager: true, nullable: true })
  @JoinColumn({ name: 'IdCliente' })
  cliente: Cliente | null;

  @Column({ name: 'IdProveedor', nullable: true })
  idProveedor: number | null;

  @ManyToOne(() => Proveedor, { eager: true, nullable: true })
  @JoinColumn({ name: 'IdProveedor' })
  proveedor: Proveedor | null;

  @CreateDateColumn({ name: 'Fecha', type: 'datetime' })
  fecha: Date;

  @Column({ name: 'MontoTotal', type: 'decimal', precision: 18, scale: 2 , transformer: transformadorDecimal})
  montoTotal: number;

  // Los pagos SIEMPRE se calculan y se guardan a tasa BCV vigente el dia del cobro
  // (no la del pedido original), segun la migracion 002.
  @Column({ name: 'ValorTasaBcvUsada', type: 'decimal', precision: 18, scale: 4 , transformer: transformadorDecimal})
  valorTasaBcvUsada: number;

  @Column({ name: 'MontoTotalEnBolivares', type: 'decimal', precision: 18, scale: 2 , transformer: transformadorDecimal})
  montoTotalEnBolivares: number;

  @Column({ name: 'Observaciones', type: 'varchar', length: 250, nullable: true })
  observaciones: string | null;

  // 'Automatico' (FIFO), 'Manual' (el usuario eligio las cuentas) o 'ContadoDirecto'
  // (pago generado junto con una venta de contado, ver migracion 008).
  @Column({ name: 'ModoDeAplicacion', type: 'varchar', length: 20, default: 'Manual' })
  modoDeAplicacion: 'Automatico' | 'Manual' | 'ContadoDirecto';

  @Column({ name: 'Anulado', type: 'tinyint', width: 1, default: 0 })
  anulado: boolean;

  @Column({ name: 'MotivoDeAnulacion', type: 'varchar', length: 250, nullable: true })
  motivoDeAnulacion: string | null;

  @Column({ name: 'FechaDeAnulacion', type: 'datetime', nullable: true })
  fechaDeAnulacion: Date | null;

  @OneToMany(() => DetallePago, (detalle) => detalle.pago, { cascade: true, eager: true })
  detalles: DetallePago[];
}

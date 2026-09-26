import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn
} from 'typeorm';
import { Cliente } from './cliente.entity';
import { Usuario } from './usuario.entity';
import { TasaDeCambio } from './tasa-de-cambio.entity';
import { DetallePedido } from './detalle-pedido.entity';
import { transformadorDecimal } from '../transformadores/decimal.transformer';

export type TipoDeOperacionDelPedido = 'Pedido' | 'Venta';
export type EstadoDelPedido = 'Pendiente' | 'Pagado' | 'Parcial' | 'Anulado';

@Entity({ name: 'Pedido' })
export class Pedido {
  @PrimaryGeneratedColumn({ name: 'IdPedido' })
  idPedido: number;

  // Si el cliente reintenta el POST /pedidos (ej: por timeout), esta clave (mandada en
  // el header X-Idempotency-Key) evita crear un segundo pedido: ver PedidosService.crearPedido.
  @Column({ name: 'ClaveDeIdempotencia', type: 'varchar', length: 100, nullable: true, unique: true })
  claveDeIdempotencia: string | null;

  @Column({ name: 'IdCliente' })
  idCliente: number;

  @ManyToOne(() => Cliente, { eager: true })
  @JoinColumn({ name: 'IdCliente' })
  cliente: Cliente;

  @Column({ name: 'IdUsuario' })
  idUsuario: number;

  @ManyToOne(() => Usuario, { eager: true })
  @JoinColumn({ name: 'IdUsuario' })
  usuario: Usuario;

  @CreateDateColumn({ name: 'Fecha', type: 'datetime' })
  fecha: Date;

  @Column({ name: 'Estado', type: 'varchar', length: 30 })
  estado: EstadoDelPedido;

  @Column({ name: 'Total', type: 'decimal', precision: 18, scale: 2, default: 0, transformer: transformadorDecimal })
  total: number;

  @Column({ name: 'MontoTotalDescontadoPorPromociones', type: 'decimal', precision: 18, scale: 2, default: 0, transformer: transformadorDecimal })
  montoTotalDescontadoPorPromociones: number;

  // Nombres de promociones aplicadas en el pedido, separados por "|" (ver migracion 007).
  @Column({ name: 'ResumenDePromocionesAplicadas', type: 'varchar', length: 500, nullable: true })
  resumenDePromocionesAplicadas: string | null;

  @Column({ name: 'TipoOperacion', type: 'varchar', length: 20, default: 'Pedido' })
  tipoOperacion: TipoDeOperacionDelPedido;

  @Column({ name: 'EsContado', type: 'tinyint', width: 1, default: 0 })
  esContado: boolean;

  @Column({ name: 'IdTasaUsada', nullable: true })
  idTasaUsada: number | null;

  @ManyToOne(() => TasaDeCambio, { eager: false, nullable: true })
  @JoinColumn({ name: 'IdTasaUsada' })
  tasaUsada: TasaDeCambio | null;

  @Column({ name: 'ValorTasaBcvUsada', type: 'decimal', precision: 18, scale: 4, nullable: true , transformer: transformadorDecimal })
  valorTasaBcvUsada: number | null;

  @Column({ name: 'ValorTasaBinanceUsada', type: 'decimal', precision: 18, scale: 4, nullable: true , transformer: transformadorDecimal })
  valorTasaBinanceUsada: number | null;

  @Column({ name: 'MontoEnBolivaresBcv', type: 'decimal', precision: 18, scale: 2, nullable: true , transformer: transformadorDecimal })
  montoEnBolivaresBcv: number | null;

  @Column({ name: 'MontoEnBolivaresBinance', type: 'decimal', precision: 18, scale: 2, nullable: true , transformer: transformadorDecimal })
  montoEnBolivaresBinance: number | null;

  @Column({ name: 'DescuentoManualGlobal', type: 'decimal', precision: 18, scale: 2, default: 0, transformer: transformadorDecimal })
  descuentoManualGlobal: number;

  @Column({ name: 'MontoTotalDescuentoManual', type: 'decimal', precision: 18, scale: 2, default: 0, transformer: transformadorDecimal })
  montoTotalDescuentoManual: number;

  @Column({ name: 'MotivoDelDescuento', type: 'varchar', length: 250, nullable: true })
  motivoDelDescuento: string | null;

  @Column({ name: 'Observaciones', type: 'varchar', length: 250, nullable: true })
  observaciones: string | null;

  @Column({ name: 'MotivoDeAnulacion', type: 'varchar', length: 250, nullable: true })
  motivoDeAnulacion: string | null;

  @Column({ name: 'FechaDeAnulacion', type: 'datetime', nullable: true })
  fechaDeAnulacion: Date | null;

  @OneToMany(() => DetallePedido, (detalle) => detalle.pedido, { cascade: true, eager: true })
  detalles: DetallePedido[];
}

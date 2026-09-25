import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { transformadorDecimal } from '../transformadores/decimal.transformer';

export type EstadoDelPedidoWeb = 'Pendiente' | 'Convirtiendo' | 'Convertido' | 'Eliminado';

@Entity({ name: 'PedidoWeb' })
export class PedidoWeb {
  @PrimaryGeneratedColumn({ name: 'IdPedidoWeb' })
  idPedidoWeb: number;

  @Column({ name: 'Codigo', type: 'varchar', length: 20 })
  codigo: string;

  @Column({ name: 'NombreDelCliente', type: 'varchar', length: 150 })
  nombreDelCliente: string;

  @Column({ name: 'Cedula', type: 'varchar', length: 20 })
  cedula: string;

  @Column({ name: 'Telefono', type: 'varchar', length: 20 })
  telefono: string;

  @Column({ name: 'Direccion', type: 'varchar', length: 300 })
  direccion: string;

  @Column({ name: 'Notas', type: 'varchar', length: 300, nullable: true })
  notas: string | null;

  @Column({ name: 'Total', type: 'decimal', precision: 18, scale: 2, transformer: transformadorDecimal })
  total: number;

  @Column({ name: 'CantidadDeArticulos', type: 'int' })
  cantidadDeArticulos: number;

  @Column({ name: 'Estado', type: 'varchar', length: 12, default: 'Pendiente' })
  estado: EstadoDelPedidoWeb;

  @Column({ name: 'IdPedido', type: 'int', nullable: true })
  idPedido: number | null;

  @Column({ name: 'IdCliente', type: 'int', nullable: true })
  idCliente: number | null;

  @Column({ name: 'MotivoDeEliminacion', type: 'varchar', length: 250, nullable: true })
  motivoDeEliminacion: string | null;

  @Column({ name: 'IdUsuarioQueGestiono', type: 'int', nullable: true })
  idUsuarioQueGestiono: number | null;

  @CreateDateColumn({ name: 'FechaCreacion', type: 'datetime' })
  fechaCreacion: Date;

  @Column({ name: 'FechaDeGestion', type: 'datetime', nullable: true })
  fechaDeGestion: Date | null;

  @Column({ name: 'ClaveDeIdempotencia', type: 'varchar', length: 100, nullable: true, select: false })
  claveDeIdempotencia: string | null;

  @Column({ name: 'IpDeOrigen', type: 'varchar', length: 45, nullable: true, select: false })
  ipDeOrigen: string | null;

  @OneToMany(() => DetallePedidoWeb, (detalle) => detalle.pedidoWeb, { cascade: true, eager: true })
  detalles: DetallePedidoWeb[];
}

@Entity({ name: 'DetallePedidoWeb' })
export class DetallePedidoWeb {
  @PrimaryGeneratedColumn({ name: 'IdDetallePedidoWeb' })
  idDetallePedidoWeb: number;

  @Column({ name: 'IdPedidoWeb', type: 'int' })
  idPedidoWeb: number;

  @ManyToOne(() => PedidoWeb, (pedido) => pedido.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'IdPedidoWeb' })
  pedidoWeb: PedidoWeb;

  @Column({ name: 'IdProducto', type: 'int' })
  idProducto: number;

  @Column({ name: 'IdProductoCatalogo', type: 'int', nullable: true })
  idProductoCatalogo: number | null;

  @Column({ name: 'Descripcion', type: 'varchar', length: 250 })
  descripcion: string;

  @Column({ name: 'NombreDeVariante', type: 'varchar', length: 80, nullable: true })
  nombreDeVariante: string | null;

  @Column({ name: 'CodigoHex', type: 'varchar', length: 7, nullable: true })
  codigoHex: string | null;

  @Column({ name: 'Cantidad', type: 'int' })
  cantidad: number;

  @Column({ name: 'PrecioUnitario', type: 'decimal', precision: 18, scale: 2, transformer: transformadorDecimal })
  precioUnitario: number;

  @Column({ name: 'Subtotal', type: 'decimal', precision: 18, scale: 2, transformer: transformadorDecimal })
  subtotal: number;
}

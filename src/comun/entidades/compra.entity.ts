import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Proveedor } from './proveedor.entity';
import { Usuario } from './usuario.entity';
import { Producto } from './producto.entity';
import { transformadorDecimal } from '../transformadores/decimal.transformer';

export type EstadoDeLaCompra = 'Pendiente' | 'Parcial' | 'Pagada' | 'Anulada';

@Entity({ name: 'Compra' })
export class Compra {
  @PrimaryGeneratedColumn({ name: 'IdCompra' })
  idCompra: number;

  @Column({ name: 'ClaveDeIdempotencia', type: 'varchar', length: 100, nullable: true, unique: true })
  claveDeIdempotencia: string | null;

  @Column({ name: 'IdProveedor' })
  idProveedor: number;

  @ManyToOne(() => Proveedor, { eager: true })
  @JoinColumn({ name: 'IdProveedor' })
  proveedor: Proveedor;

  @Column({ name: 'IdUsuario' })
  idUsuario: number;

  @ManyToOne(() => Usuario, { eager: true })
  @JoinColumn({ name: 'IdUsuario' })
  usuario: Usuario;

  @Column({ name: 'NumeroDeFactura', type: 'varchar', length: 60, nullable: true })
  numeroDeFactura: string | null;

  @Column({ name: 'FechaDeFactura', type: 'date', nullable: true })
  fechaDeFactura: string | null;

  @CreateDateColumn({ name: 'Fecha', type: 'datetime' })
  fecha: Date;

  @Column({ name: 'Estado', type: 'varchar', length: 20 })
  estado: EstadoDeLaCompra;

  @Column({ name: 'EsContado', type: 'tinyint', width: 1, default: 0 })
  esContado: boolean;

  @Column({ name: 'Subtotal', type: 'decimal', precision: 18, scale: 2, default: 0, transformer: transformadorDecimal })
  subtotal: number;

  @Column({ name: 'MontoDeDescuento', type: 'decimal', precision: 18, scale: 2, default: 0, transformer: transformadorDecimal })
  montoDeDescuento: number;

  @Column({ name: 'GastosAdicionales', type: 'decimal', precision: 18, scale: 2, default: 0, transformer: transformadorDecimal })
  gastosAdicionales: number;

  @Column({ name: 'Total', type: 'decimal', precision: 18, scale: 2, default: 0, transformer: transformadorDecimal })
  total: number;

  @Column({ name: 'ValorTasaBcvUsada', type: 'decimal', precision: 18, scale: 4, nullable: true, transformer: transformadorDecimal })
  valorTasaBcvUsada: number | null;

  @Column({ name: 'MontoEnBolivaresBcv', type: 'decimal', precision: 18, scale: 2, nullable: true, transformer: transformadorDecimal })
  montoEnBolivaresBcv: number | null;

  @Column({ name: 'Observaciones', type: 'varchar', length: 250, nullable: true })
  observaciones: string | null;

  @Column({ name: 'MotivoDeAnulacion', type: 'varchar', length: 250, nullable: true })
  motivoDeAnulacion: string | null;

  @Column({ name: 'FechaDeAnulacion', type: 'datetime', nullable: true })
  fechaDeAnulacion: Date | null;

  @OneToMany(() => DetalleCompra, (detalle) => detalle.compra, { cascade: true, eager: true })
  detalles: DetalleCompra[];
}

@Entity({ name: 'DetalleCompra' })
export class DetalleCompra {
  @PrimaryGeneratedColumn({ name: 'IdDetalleCompra' })
  idDetalleCompra: number;

  @Column({ name: 'IdCompra' })
  idCompra: number;

  @ManyToOne(() => Compra, (compra) => compra.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'IdCompra' })
  compra: Compra;

  @Column({ name: 'IdProducto' })
  idProducto: number;

  @ManyToOne(() => Producto, { eager: true })
  @JoinColumn({ name: 'IdProducto' })
  producto: Producto;

  @Column({ name: 'Cantidad', type: 'int' })
  cantidad: number;

  @Column({ name: 'CostoUnitario', type: 'decimal', precision: 18, scale: 4, transformer: transformadorDecimal })
  costoUnitario: number;

  @Column({ name: 'CostoUnitarioFinal', type: 'decimal', precision: 18, scale: 4, transformer: transformadorDecimal })
  costoUnitarioFinal: number;

  @Column({ name: 'Subtotal', type: 'decimal', precision: 18, scale: 2, transformer: transformadorDecimal })
  subtotal: number;

  @Column({ name: 'ExistenciaAnterior', type: 'int', default: 0 })
  existenciaAnterior: number;

  @Column({ name: 'CostoPromedioAnterior', type: 'decimal', precision: 18, scale: 4, default: 0, transformer: transformadorDecimal })
  costoPromedioAnterior: number;

  @Column({ name: 'CostoPromedioResultante', type: 'decimal', precision: 18, scale: 4, default: 0, transformer: transformadorDecimal })
  costoPromedioResultante: number;
}

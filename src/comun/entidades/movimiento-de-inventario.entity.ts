import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Producto } from './producto.entity';
import { Usuario } from './usuario.entity';
import { transformadorDecimal } from '../transformadores/decimal.transformer';

export type TipoDeMovimientoDeInventario = 'Entrada' | 'Salida';

export type OrigenDelMovimientoDeInventario =
  | 'Inicial'
  | 'Ajuste'
  | 'Compra'
  | 'Venta'
  | 'AnulacionVenta'
  | 'AnulacionCompra';

@Entity({ name: 'MovimientoDeInventario' })
export class MovimientoDeInventario {
  @PrimaryGeneratedColumn({ name: 'IdMovimiento' })
  idMovimiento: number;

  @Column({ name: 'IdProducto' })
  idProducto: number;

  @ManyToOne(() => Producto, { eager: true })
  @JoinColumn({ name: 'IdProducto' })
  producto: Producto;

  @Column({ name: 'TipoMovimiento', type: 'varchar', length: 10 })
  tipoMovimiento: TipoDeMovimientoDeInventario;

  @Column({ name: 'Origen', type: 'varchar', length: 20, default: 'Ajuste' })
  origen: OrigenDelMovimientoDeInventario;

  @Column({ name: 'IdReferencia', type: 'int', nullable: true })
  idReferencia: number | null;

  @Column({ name: 'Cantidad', type: 'int' })
  cantidad: number;

  @Column({ name: 'CostoUnitario', type: 'decimal', precision: 18, scale: 4, nullable: true, transformer: transformadorDecimal })
  costoUnitario: number | null;

  @Column({ name: 'Observaciones', type: 'varchar', length: 250, nullable: true })
  observaciones: string | null;

  @Column({ name: 'IdUsuario', type: 'int', nullable: true })
  idUsuario: number | null;

  @ManyToOne(() => Usuario, { eager: true, nullable: true })
  @JoinColumn({ name: 'IdUsuario' })
  usuario: Usuario | null;

  @Column({ name: 'ExistenciaResultante', type: 'int', nullable: true })
  existenciaResultante: number | null;

  @Column({ name: 'CostoPromedioResultante', type: 'decimal', precision: 18, scale: 4, nullable: true, transformer: transformadorDecimal })
  costoPromedioResultante: number | null;

  @CreateDateColumn({ name: 'Fecha', type: 'datetime' })
  fecha: Date;
}

import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Producto } from './producto.entity';
import { transformadorDecimal } from '../transformadores/decimal.transformer';

export type TipoDePromocion =
  | 'DescuentoPorCantidad'
  | 'PrecioEspecial'
  | 'DescuentoPorMontoPedido'
  | 'ProductoGratisPorMonto';

@Entity({ name: 'Promocion' })
export class Promocion {
  @PrimaryGeneratedColumn({ name: 'IdPromocion' })
  idPromocion: number;

  @Column({ name: 'Nombre', type: 'varchar', length: 150 })
  nombre: string;

  @Column({ name: 'Descripcion', type: 'varchar', length: 250, nullable: true })
  descripcion: string | null;

  @Column({ name: 'TipoPromocion', type: 'varchar', length: 30 })
  tipoPromocion: TipoDePromocion;

  @Column({ name: 'FechaInicio', type: 'datetime' })
  fechaInicio: Date;

  @Column({ name: 'FechaFin', type: 'datetime' })
  fechaFin: Date;

  @Column({ name: 'Activo', type: 'tinyint', width: 1, default: 1 })
  activo: boolean;

  @Column({ name: 'Acumulable', type: 'tinyint', width: 1, default: 0 })
  acumulable: boolean;

  @OneToMany(() => PromocionProducto, (p) => p.promocion, { cascade: true, eager: true })
  productos: PromocionProducto[];

  @OneToMany(() => ReglaCantidad, (r) => r.promocion, { cascade: true, eager: true })
  reglasDeCantidad: ReglaCantidad[];

  @OneToMany(() => ReglaPrecioEspecial, (r) => r.promocion, { cascade: true, eager: true })
  reglasDePrecioEspecial: ReglaPrecioEspecial[];

  @OneToMany(() => ReglaMontoPedido, (r) => r.promocion, { cascade: true, eager: true })
  reglasDeMontoPedido: ReglaMontoPedido[];
}

@Entity({ name: 'PromocionProducto' })
export class PromocionProducto {
  @PrimaryGeneratedColumn({ name: 'IdPromocionProducto' })
  idPromocionProducto: number;

  @Column({ name: 'IdPromocion' })
  idPromocion: number;

  @ManyToOne(() => Promocion, (p) => p.productos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'IdPromocion' })
  promocion: Promocion;

  @Column({ name: 'IdProducto' })
  idProducto: number;

  @ManyToOne(() => Producto, { eager: true })
  @JoinColumn({ name: 'IdProducto' })
  producto: Producto;
}

@Entity({ name: 'ReglaCantidad' })
export class ReglaCantidad {
  @PrimaryGeneratedColumn({ name: 'IdRegla' })
  idRegla: number;

  @Column({ name: 'IdPromocion' })
  idPromocion: number;

  @ManyToOne(() => Promocion, (p) => p.reglasDeCantidad, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'IdPromocion' })
  promocion: Promocion;

  @Column({ name: 'CantidadMinima', type: 'int' })
  cantidadMinima: number;

  @Column({ name: 'TipoDescuento', type: 'varchar', length: 20 })
  tipoDescuento: 'Porcentaje' | 'MontoFijo';

  @Column({ name: 'ValorDescuento', type: 'decimal', precision: 18, scale: 2 , transformer: transformadorDecimal})
  valorDescuento: number;
}

@Entity({ name: 'ReglaPrecioEspecial' })
export class ReglaPrecioEspecial {
  @PrimaryGeneratedColumn({ name: 'IdRegla' })
  idRegla: number;

  @Column({ name: 'IdPromocion' })
  idPromocion: number;

  @ManyToOne(() => Promocion, (p) => p.reglasDePrecioEspecial, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'IdPromocion' })
  promocion: Promocion;

  @Column({ name: 'IdProducto' })
  idProducto: number;

  @ManyToOne(() => Producto, { eager: true })
  @JoinColumn({ name: 'IdProducto' })
  producto: Producto;

  @Column({ name: 'PrecioEspecial', type: 'decimal', precision: 18, scale: 2 , transformer: transformadorDecimal})
  precioEspecial: number;
}

@Entity({ name: 'ReglaMontoPedido' })
export class ReglaMontoPedido {
  @PrimaryGeneratedColumn({ name: 'IdRegla' })
  idRegla: number;

  @Column({ name: 'IdPromocion' })
  idPromocion: number;

  @ManyToOne(() => Promocion, (p) => p.reglasDeMontoPedido, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'IdPromocion' })
  promocion: Promocion;

  @Column({ name: 'MontoMinimoPedido', type: 'decimal', precision: 18, scale: 2 , transformer: transformadorDecimal})
  montoMinimoPedido: number;

  @Column({ name: 'TipoBeneficio', type: 'varchar', length: 30 })
  tipoBeneficio: 'DescuentoPorcentaje' | 'ProductoGratis';

  @Column({ name: 'ValorDescuento', type: 'decimal', precision: 18, scale: 2, nullable: true , transformer: transformadorDecimal })
  valorDescuento: number | null;

  @Column({ name: 'IdProductoRegalo', nullable: true })
  idProductoRegalo: number | null;

  @ManyToOne(() => Producto, { eager: true, nullable: true })
  @JoinColumn({ name: 'IdProductoRegalo' })
  productoRegalo: Producto | null;
}

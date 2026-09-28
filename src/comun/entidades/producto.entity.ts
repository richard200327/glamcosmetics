import { FamiliaDeColor, ProductoDeCatalogo } from './catalogo.entity';
import { Column, JoinColumn, ManyToOne, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { transformadorDecimal } from '../transformadores/decimal.transformer';

@Entity({ name: 'Producto' })
export class Producto {
  @PrimaryGeneratedColumn({ name: 'IdProducto' })
  idProducto: number;

  @Column({ name: 'Codigo', type: 'varchar', length: 50 })
  codigo: string;

  @Column({ name: 'CodigoDeBarras', type: 'varchar', length: 50, nullable: true })
  codigoDeBarras: string | null;

  @Column({ name: 'Descripcion', type: 'varchar', length: 250 })
  descripcion: string;

  @Column({ name: 'Existencia', type: 'int', default: 0 })
  existencia: number;

  @Column({ name: 'PrecioUnitario', type: 'decimal', precision: 18, scale: 2 , transformer: transformadorDecimal})
  precioUnitario: number;

  // Costo promedio ponderado de adquisicion/produccion. Se usa para calcular la
  // ganancia bruta en reportes (PrecioUnitario - CostoPromedio). No se expone al cliente
  // final, solo en pantallas internas (ficha de producto, listado de inventario, reportes).
  @Column({ name: 'CostoPromedio', type: 'decimal', precision: 18, scale: 4, default: 0, transformer: transformadorDecimal })
  costoPromedio: number;

  @Column({ name: 'PrecioAlMayor', type: 'decimal', precision: 18, scale: 2, nullable: true , transformer: transformadorDecimal })
  precioAlMayor: number | null;

  @Column({ name: 'CantidadMinimaParaPrecioAlMayor', type: 'int', default: 0 })
  cantidadMinimaParaPrecioAlMayor: number;

  // Umbral para la alerta de "stock bajo" (dashboard, campana de notificaciones):
  // cuando Existencia baja a este numero o menos (pero todavia no llega a 0), el
  // producto se marca como "stock bajo" en vez de esperar a que se agote del todo.
  @Column({ name: 'ExistenciaMinima', type: 'int', default: 5 })
  existenciaMinima: number;

  @Column({ name: 'Activo', type: 'tinyint', width: 1, default: 1 })
  activo: boolean;

  @Column({ name: 'IdProductoCatalogo', type: 'int', nullable: true })
  idProductoCatalogo: number | null;

  @ManyToOne(() => ProductoDeCatalogo, (catalogo) => catalogo.variantes, { nullable: true })
  @JoinColumn({ name: 'IdProductoCatalogo' })
  productoDeCatalogo: ProductoDeCatalogo | null;

  @Column({ name: 'NombreDeVariante', type: 'varchar', length: 80, nullable: true })
  nombreDeVariante: string | null;

  @Column({ name: 'CodigoHex', type: 'varchar', length: 7, nullable: true })
  codigoHex: string | null;

  @Column({ name: 'IdFamiliaDeColor', type: 'int', nullable: true })
  idFamiliaDeColor: number | null;

  @ManyToOne(() => FamiliaDeColor, { nullable: true })
  @JoinColumn({ name: 'IdFamiliaDeColor' })
  familiaDeColor: FamiliaDeColor | null;

  @Column({ name: 'OrdenEnCatalogo', type: 'int', default: 0 })
  ordenEnCatalogo: number;
}

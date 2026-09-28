import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Pedido } from './pedido.entity';
import { Producto } from './producto.entity';
import { transformadorDecimal } from '../transformadores/decimal.transformer';

@Entity({ name: 'DetallePedido' })
export class DetallePedido {
  @PrimaryGeneratedColumn({ name: 'IdDetallePedido' })
  idDetallePedido: number;

  @Column({ name: 'IdPedido' })
  idPedido: number;

  @ManyToOne(() => Pedido, (pedido) => pedido.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'IdPedido' })
  pedido: Pedido;

  @Column({ name: 'IdProducto' })
  idProducto: number;

  @ManyToOne(() => Producto, { eager: true })
  @JoinColumn({ name: 'IdProducto' })
  producto: Producto;

  @Column({ name: 'Cantidad', type: 'int' })
  cantidad: number;

  @Column({ name: 'PrecioUnitario', type: 'decimal', precision: 18, scale: 2 , transformer: transformadorDecimal})
  precioUnitario: number;

  // Snapshot del costo promedio del producto al momento de la venta. Se usa para que
  // la ganancia historica de este pedido no cambie si el costo promedio actual del
  // producto es distinto en el futuro (ver migracion 004).
  @Column({ name: 'CostoUnitarioUsado', type: 'decimal', precision: 18, scale: 4, default: 0, transformer: transformadorDecimal })
  costoUnitarioUsado: number;

  // Snapshot de la promocion aplicada a esta linea al momento de la venta (o null si
  // no aplico ninguna). Se persiste para que el historial no cambie si la promocion
  // se desactiva o se borra despues.
  @Column({ name: 'NombrePromocionAplicada', type: 'varchar', length: 150, nullable: true })
  nombrePromocionAplicadaEnLinea: string | null;

  @Column({ name: 'SeUsoPrecioAlMayor', type: 'tinyint', width: 1, default: 0 })
  seUsoPrecioAlMayorEnEstaLinea: boolean;

  @Column({ name: 'PrecioDeLista', type: 'decimal', precision: 18, scale: 2, nullable: true, transformer: transformadorDecimal })
  precioDeLista: number | null;

  @Column({ name: 'EsRegalo', type: 'tinyint', width: 1, default: 0 })
  esRegalo: boolean;

  @Column({ name: 'DescuentoManual', type: 'decimal', precision: 18, scale: 2, default: 0, transformer: transformadorDecimal })
  descuentoManual: number;

  @Column({ name: 'Subtotal', type: 'decimal', precision: 18, scale: 2 , transformer: transformadorDecimal})
  subtotal: number;
}

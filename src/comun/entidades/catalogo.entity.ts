import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { transformadorBooleano } from '../transformadores/booleano.transformer';
import { transformadorDecimal } from '../transformadores/decimal.transformer';
import { Producto } from './producto.entity';

@Entity({ name: 'Marca' })
export class Marca {
  @PrimaryGeneratedColumn({ name: 'IdMarca' })
  idMarca: number;

  @Column({ name: 'Nombre', type: 'varchar', length: 80 })
  nombre: string;

  @Column({ name: 'Slug', type: 'varchar', length: 100 })
  slug: string;

  @Column({ name: 'Descripcion', type: 'varchar', length: 250, nullable: true })
  descripcion: string | null;

  @Column({ name: 'Orden', type: 'int', default: 0 })
  orden: number;

  @Column({ name: 'Activa', type: 'tinyint', width: 1, default: 1, transformer: transformadorBooleano })
  activa: boolean;
}

@Entity({ name: 'Categoria' })
export class Categoria {
  @PrimaryGeneratedColumn({ name: 'IdCategoria' })
  idCategoria: number;

  @Column({ name: 'Nombre', type: 'varchar', length: 80 })
  nombre: string;

  @Column({ name: 'Slug', type: 'varchar', length: 100 })
  slug: string;

  @Column({ name: 'Descripcion', type: 'varchar', length: 250, nullable: true })
  descripcion: string | null;

  @Column({ name: 'Orden', type: 'int', default: 0 })
  orden: number;

  @Column({ name: 'Activa', type: 'tinyint', width: 1, default: 1, transformer: transformadorBooleano })
  activa: boolean;
}

@Entity({ name: 'FamiliaDeColor' })
export class FamiliaDeColor {
  @PrimaryGeneratedColumn({ name: 'IdFamiliaDeColor' })
  idFamiliaDeColor: number;

  @Column({ name: 'Nombre', type: 'varchar', length: 60 })
  nombre: string;

  @Column({ name: 'CodigoHex', type: 'varchar', length: 7 })
  codigoHex: string;

  @Column({ name: 'Orden', type: 'int', default: 0 })
  orden: number;

  @Column({ name: 'Activa', type: 'tinyint', width: 1, default: 1, transformer: transformadorBooleano })
  activa: boolean;
}

@Entity({ name: 'ProductoDeCatalogo' })
export class ProductoDeCatalogo {
  @PrimaryGeneratedColumn({ name: 'IdProductoCatalogo' })
  idProductoCatalogo: number;

  @Column({ name: 'Nombre', type: 'varchar', length: 150 })
  nombre: string;

  @Column({ name: 'Slug', type: 'varchar', length: 170 })
  slug: string;

  @Column({ name: 'IdMarca', type: 'int', nullable: true })
  idMarca: number | null;

  @ManyToOne(() => Marca, { eager: true, nullable: true })
  @JoinColumn({ name: 'IdMarca' })
  marca: Marca | null;

  @Column({ name: 'IdCategoria', type: 'int', nullable: true })
  idCategoria: number | null;

  @ManyToOne(() => Categoria, { eager: true, nullable: true })
  @JoinColumn({ name: 'IdCategoria' })
  categoria: Categoria | null;

  @Column({ name: 'DescripcionCorta', type: 'varchar', length: 250, nullable: true })
  descripcionCorta: string | null;

  @Column({ name: 'Descripcion', type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ name: 'ModoDeUso', type: 'text', nullable: true })
  modoDeUso: string | null;

  @Column({ name: 'Ingredientes', type: 'text', nullable: true })
  ingredientes: string | null;

  @Column({ name: 'Atributos', type: 'varchar', length: 250, nullable: true })
  atributos: string | null;

  @Column({ name: 'NombreDeLaVariante', type: 'varchar', length: 30, default: 'Tono' })
  nombreDeLaVariante: string;

  @Column({ name: 'Visible', type: 'tinyint', width: 1, default: 1, transformer: transformadorBooleano })
  visible: boolean;

  @Column({ name: 'Destacado', type: 'tinyint', width: 1, default: 0, transformer: transformadorBooleano })
  destacado: boolean;

  @Column({ name: 'Orden', type: 'int', default: 0 })
  orden: number;

  @CreateDateColumn({ name: 'FechaCreacion', type: 'datetime' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'FechaActualizacion', type: 'datetime' })
  fechaActualizacion: Date;

  @OneToMany(() => Producto, (producto) => producto.productoDeCatalogo)
  variantes: Producto[];
}

@Entity({ name: 'ImagenDeCatalogo' })
export class ImagenDeCatalogo {
  @PrimaryGeneratedColumn({ name: 'IdImagen' })
  idImagen: number;

  @Column({ name: 'IdProductoCatalogo', type: 'int' })
  idProductoCatalogo: number;

  @Column({ name: 'IdProducto', type: 'int', nullable: true })
  idProducto: number | null;

  @Column({ name: 'Datos', type: 'mediumblob', select: false })
  datos: Buffer;

  @Column({ name: 'Miniatura', type: 'mediumblob', select: false })
  miniatura: Buffer;

  @Column({ name: 'TipoMime', type: 'varchar', length: 30 })
  tipoMime: string;

  @Column({ name: 'Ancho', type: 'int', default: 0 })
  ancho: number;

  @Column({ name: 'Alto', type: 'int', default: 0 })
  alto: number;

  @Column({ name: 'Tamano', type: 'int', default: 0 })
  tamano: number;

  @Column({ name: 'TextoAlternativo', type: 'varchar', length: 200, nullable: true })
  textoAlternativo: string | null;

  @Column({ name: 'Orden', type: 'int', default: 0 })
  orden: number;

  @CreateDateColumn({ name: 'FechaCreacion', type: 'datetime' })
  fechaCreacion: Date;
}

@Entity({ name: 'ConfiguracionDeTienda' })
export class ConfiguracionDeTienda {
  @PrimaryColumn({ name: 'IdConfiguracion', type: 'int' })
  idConfiguracion: number;

  @Column({ name: 'NombreDeLaTienda', type: 'varchar', length: 80 })
  nombreDeLaTienda: string;

  @Column({ name: 'Eslogan', type: 'varchar', length: 150, nullable: true })
  eslogan: string | null;

  @Column({ name: 'NumeroDeWhatsApp', type: 'varchar', length: 20, nullable: true })
  numeroDeWhatsApp: string | null;

  @Column({ name: 'Instagram', type: 'varchar', length: 60, nullable: true })
  instagram: string | null;

  @Column({ name: 'Direccion', type: 'varchar', length: 250, nullable: true })
  direccion: string | null;

  @Column({ name: 'HorarioDeAtencion', type: 'varchar', length: 150, nullable: true })
  horarioDeAtencion: string | null;

  @Column({ name: 'MensajeDeEnvio', type: 'varchar', length: 250, nullable: true })
  mensajeDeEnvio: string | null;

  @Column({ name: 'MostrarPreciosEnBolivares', type: 'tinyint', width: 1, transformer: transformadorBooleano })
  mostrarPreciosEnBolivares: boolean;

  @Column({ name: 'MostrarExistenciaBaja', type: 'tinyint', width: 1, transformer: transformadorBooleano })
  mostrarExistenciaBaja: boolean;

  @Column({ name: 'UmbralDeExistenciaBaja', type: 'int' })
  umbralDeExistenciaBaja: number;

  @Column({ name: 'MontoMinimoDePedido', type: 'decimal', precision: 18, scale: 2, transformer: transformadorDecimal })
  montoMinimoDePedido: number;

  @Column({ name: 'HorasDeReserva', type: 'int' })
  horasDeReserva: number;

  @UpdateDateColumn({ name: 'FechaDeActualizacion', type: 'datetime' })
  fechaDeActualizacion: Date;
}

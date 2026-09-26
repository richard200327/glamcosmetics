import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'MetodoPago' })
export class MetodoPago {
  @PrimaryGeneratedColumn({ name: 'IdMetodoPago' })
  idMetodoPago: number;

  @Column({ name: 'Nombre', type: 'varchar', length: 50 })
  nombre: string;

  @Column({ name: 'Activo', type: 'tinyint', width: 1, default: 1 })
  activo: boolean;
}

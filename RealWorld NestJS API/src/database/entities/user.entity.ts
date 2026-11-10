import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 254, unique: true })
  email!: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash!: string;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ type: 'text', nullable: true })
  image!: string | null;

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', precision: 6 })
  updatedAt!: Date;
}

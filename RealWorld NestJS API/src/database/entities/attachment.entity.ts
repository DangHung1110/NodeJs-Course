import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AttachmentOwnerType {
  UserAvatar = 'user-avatar',
}

@Entity({ name: 'attachments' })
@Index('IDX_attachments_owner', ['ownerType', 'ownerId'])
export class AttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'owner_type',
    type: 'enum',
    enum: AttachmentOwnerType,
  })
  ownerType!: AttachmentOwnerType;

  @Column({ name: 'owner_id', type: 'char', length: 36 })
  ownerId!: string;

  @Column({ type: 'text' })
  url!: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ name: 'file_type', type: 'varchar', length: 100 })
  fileType!: string;

  @Column({ name: 'file_size', type: 'int', unsigned: true })
  fileSize!: number;

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', precision: 6 })
  updatedAt!: Date;
}

import 'reflect-metadata';
import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	ManyToOne,
	JoinColumn,
} from 'typeorm';
import User from './User';
import Stock from './Stock';

export enum OrderType {
	SELL = 0,
	BUY = 1,
}

export enum OrderStatus {
	PENDING = 'pending',
}

@Entity()
export default class Order {
	@PrimaryGeneratedColumn()
	order_id: number;

	@ManyToOne(() => User, (user: User) => user.user_id)
	@JoinColumn({ name: 'user_id' })
	user_id: number;

	@ManyToOne(() => Stock, (stock: Stock) => stock.stock_id)
	@JoinColumn({ name: 'stock_id' })
	stock_id: number;

	@Column({ type: 'enum', enum: OrderType })
	type: number;

	@Column()
	amount: number;

	@Column()
	price: number;

	@Column({ type: 'datetime' })
	created_at: Date;

	@Column({
		type: 'enum',
		enum: OrderStatus,
		default: OrderStatus.PENDING,
	})
	status: OrderStatus;
}

import mongoose from 'mongoose';

const { Schema } = mongoose;

export interface ITransaction {
	transactionId: number;
	bidUserId: number;
	askUserId: number;
	stockCode: string;
	amount: number;
	price: number;
	createdAt: number;
}

export const TransactionSchema = new Schema<ITransaction>(
	{
		transactionId: Number,
		bidUserId: Number,
		askUserId: Number,
		stockCode: String,
		amount: Number,
		price: Number,
		createdAt: Number,
	},
	{ collection: 'transaction' },
);

export default mongoose.model('Transaction', TransactionSchema);

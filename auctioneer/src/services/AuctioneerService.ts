/* eslint-disable class-methods-use-this */
import { getConnection } from 'typeorm';
import { StockRepository, UserRepository, UserStockRepository, OrderRepository, ChartRepository } from '@repositories/index';
import { UserStock, OrderType, Stock, Order } from '@models/index';
import BidAskTransaction, { ITransactionLog } from './BidAskTransaction';
import { OrderError, OrderErrorMessage } from './errors';

function donothing() {}

export default class AuctioneerService {
	static instance: AuctioneerService | null = null;

	constructor() {
		if (AuctioneerService.instance) return AuctioneerService.instance;
		AuctioneerService.instance = this;
	}

	public async bidAsk(stockId: number, code: string): Promise<boolean> {
		let result = false;
		const connection = getConnection();
		const queryRunner = connection.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			const StockRepositoryRunner = queryRunner.manager.getCustomRepository(StockRepository);
			const UserRepositoryRunner = queryRunner.manager.getCustomRepository(UserRepository);
			const UserStockRepositoryRunner = queryRunner.manager.getCustomRepository(UserStockRepository);
			const OrderRepositoryRunner = queryRunner.manager.getCustomRepository(OrderRepository);
			const ChartRepositoryRunner = queryRunner.manager.getCustomRepository(ChartRepository);

			const [stock, orderAsk, orderBid]: [Stock | undefined, Order | undefined, Order | undefined] = await Promise.all([
				StockRepositoryRunner.readStockById(stockId),
				OrderRepositoryRunner.readOrderByDesc(stockId, OrderType.BUY),
				OrderRepositoryRunner.readOrderByAsc(stockId, OrderType.SELL),
			]);

			if (stock === undefined || orderAsk === undefined || orderBid === undefined || orderBid.price > orderAsk.price)
				throw new OrderError(OrderErrorMessage.NO_ORDERS_AVAILABLE);

			const task = new BidAskTransaction(
				StockRepositoryRunner,
				UserRepositoryRunner,
				UserStockRepositoryRunner,
				OrderRepositoryRunner,
				ChartRepositoryRunner,
			);

			const transactionLog: ITransactionLog = {
				code,
				price: orderAsk.createdAt < orderBid.createdAt ? orderAsk.price : orderBid.price,
				amount: Math.min(orderBid.amount, orderAsk.amount),
				createdAt: new Date().getTime(),
			};

			await task.init(transactionLog);

			const askUser = await UserRepositoryRunner.readUserById(orderAsk.userId);
			if (askUser === undefined) throw new OrderError(OrderErrorMessage.NO_ORDERS_AVAILABLE);
			const askUserStock = askUser.stocks.find((userStock: UserStock) => userStock.stockId === stockId);

			const bidUser = await UserRepositoryRunner.readUserById(orderBid.userId);
			if (bidUser === undefined) throw new OrderError(OrderErrorMessage.NO_ORDERS_AVAILABLE);
			const bidUserStock = bidUser.stocks.find((userStock: UserStock) => userStock.stockId === stockId);

			await Promise.all([
				task.bidOrderProcess(bidUser, bidUserStock, orderBid),
				task.askOrderProcess(askUser, askUserStock, orderAsk),
			]);
			await task.noticeProcess(stock);
			queryRunner.commitTransaction();
			result = true;
		} catch (err) {
			if (err instanceof OrderError) donothing();
			queryRunner.rollbackTransaction();
			result = false;
		} finally {
			queryRunner.release();
		}
		return result;
	}
}
import React from 'react';
import toast from 'react-hot-toast';
import { SetterOrUpdater, useSetRecoilState } from 'recoil';
import webSocketAtom from '@recoil/websocket/atom';
import stockListAtom, { IStockListItem, IStockChartItem } from '@recoil/stockList/atom';
import { IAskOrderItem, IBidOrderItem, askOrdersAtom, bidOrdersAtom } from '@recoil/stockOrders/index';
import stockExecutionAtom, { IStockExecutionItem } from './recoil/stockExecution/atom';
import { translateRequestData, translateResponseData } from './common/utils/socketUtils';
import Emitter from './common/utils/eventEmitter';
import HoldStockListAtom from './recoil/holdStockList/atom';
import { getHoldStocks } from './pages/trade/sideBar/refreshStockData';

interface IProps {
	children: React.ReactNode;
}
interface IStartSocket {
	setSocket: SetterOrUpdater<WebSocket | null>;
	setStockList: SetterOrUpdater<IStockListItem[]>;
	setStockExecution: SetterOrUpdater<IStockExecutionItem[]>;
	setAskOrders: SetterOrUpdater<IAskOrderItem[]>;
	setBidOrders: SetterOrUpdater<IBidOrderItem[]>;
	setHold: SetterOrUpdater<string[]>;
}
interface IResponseConclusions {
	createdAt: number;
	price: number;
	amount: number;
	_id: string;
}
interface IMatchData {
	createdAt: number;
	price: number;
	amount: number;
	code: string;
	id: string;
}
interface INonTargetStockData {
	code: string;
	price: number;
	amount: number;
}
interface ITargetStockData {
	code: string;
	price: number;
	amount: number;
	createdAt: Date;
}
interface IOrder {
	price: number;
	type: number;
	amount: number;
}

const MAX_NUM_OF_ORDER_BARS = 10;
const MAX_EXECUTION_SIZE = 50;

let reconnector: NodeJS.Timer;

// 해당 가격의 호가 막대가 존재하는지 판별
function isOrderBarExist(orders: Array<IAskOrderItem | IBidOrderItem>, orderPrice: number): boolean {
	return !!orders.find(({ price }) => price === orderPrice);
}

function createNewOrderBar(orders: Array<IAskOrderItem | IBidOrderItem>, order: IOrder): Array<IAskOrderItem | IBidOrderItem> {
	const numOfOrders = orders.length;
	const { type, price: orderPrice, amount } = order;
	let insertIdx = orders.findIndex(({ price }) => price < orderPrice);
	insertIdx = insertIdx === -1 ? numOfOrders : insertIdx;

	const result = [
		...orders.slice(0, insertIdx),
		{
			type,
			price: orderPrice,
			amount,
		},
		...orders.slice(insertIdx, numOfOrders),
	];

	const resultLength = result.length;

	if (resultLength <= MAX_NUM_OF_ORDER_BARS) return type === 1 ? (result as IAskOrderItem[]) : (result as IBidOrderItem[]);
	return type === 1
		? (result.slice(1, resultLength) as IAskOrderItem[])
		: (result.slice(0, resultLength - 1) as IBidOrderItem[]);
}

function updateNonTargetStock(stockList: IStockListItem[], data: INonTargetStockData): IStockListItem[] {
	const { code: stockCode, price, amount } = data;

	return stockList.map((stockItem) => {
		if (stockItem.code !== stockCode) return stockItem;

		const newChartsData: IStockChartItem[] = stockItem.charts.map((chartItem) => {
			return chartItem.type === 1
				? chartItem
				: {
						...chartItem,
						volume: chartItem.volume + price * amount,
				  };
		});

		return {
			...stockItem,
			price,
			amount,
			charts: newChartsData,
		};
	});
}

function updateTargetStock(
	stockList: IStockListItem[],
	data: ITargetStockData,
	currentChart: IStockChartItem[],
): IStockListItem[] {
	const { code: stockCode, price, amount } = data;
	return stockList.map((stockItem) => {
		if (stockItem.code !== stockCode) return stockItem;

		return {
			...stockItem,
			price,
			amount,
			charts: currentChart,
		};
	});
}

// 주문 접수 시 호가 정보 수정
function updateOrdersAfterAcceptOrder(
	orders: Array<IAskOrderItem | IBidOrderItem>,
	order: IOrder,
): Array<IAskOrderItem | IBidOrderItem> {
	const { price: orderPrice, amount: orderAmount, type: orderType } = order;

	if (!isOrderBarExist(orders, orderPrice)) {
		const result = createNewOrderBar(orders, order);
		return orderType === 1 ? (result as IAskOrderItem[]) : (result as IBidOrderItem[]);
	}

	const result = orders.map(({ type, price, amount }) =>
		price === orderPrice && type === orderType ? { type, price, amount: amount + orderAmount } : { type, price, amount },
	);

	return orderType === 1 ? (result as IAskOrderItem[]) : (result as IBidOrderItem[]);
}

function updateAskOrders(orders: IAskOrderItem[]): IAskOrderItem[] {
	return orders.map<IAskOrderItem>((order) => ({ ...order, amount: Number(order.amount) }));
}

function updateBidOrders(orders: IBidOrderItem[]): IBidOrderItem[] {
	return orders.map<IBidOrderItem>((order) => ({ ...order, amount: Number(order.amount) }));
}

const dataToExecutionForm = (conclusionList: IResponseConclusions[]): IStockExecutionItem[] =>
	conclusionList.map(({ createdAt, price, amount, _id }): IStockExecutionItem => {
		return {
			timestamp: createdAt,
			price,
			volume: price * amount,
			amount,
			id: _id,
		};
	});

const addNewExecution = (setStockExecution: SetterOrUpdater<IStockExecutionItem[]>, match: IMatchData) => {
	const newExecution = {
		id: match.id,
		price: match.price,
		amount: match.amount,
		timestamp: match.createdAt,
		volume: match.price * match.amount,
	};
	setStockExecution((prev) => {
		const executionList = [newExecution, ...prev];
		if (executionList.length > MAX_EXECUTION_SIZE) executionList.pop();

		return executionList;
	});
};

const startSocket = ({ setSocket, setStockList, setStockExecution, setAskOrders, setBidOrders, setHold }: IStartSocket) => {
	const webSocket = new WebSocket(process.env.WEBSOCKET || '');
	webSocket.binaryType = 'arraybuffer';

	webSocket.onopen = () => {
		setSocket(webSocket);
		clearInterval(reconnector);
	};
	webSocket.onclose = () => {
		clearInterval(reconnector);
		reconnector = setInterval(() => {
			startSocket({ setSocket, setStockList, setStockExecution, setAskOrders, setBidOrders, setHold });
		}, 1000);
	};
	webSocket.onmessage = async (event) => {
		const { type, data } = translateResponseData(event.data);
		switch (type) {
			case 'stocksInfo': {
				setStockList(data);
				break;
			}
			case 'updateStock': {
				if (!data) return;
				setStockList((prev) => updateNonTargetStock(prev, data));
				break;
			}
			case 'updateTarget': {
				const { match: matchData, currentChart, order, bidAsk } = data;
				// 주문 접수 케이스
				if (order) {
					if (order.type === 1) setAskOrders((prev) => updateOrdersAfterAcceptOrder(prev, order) as IAskOrderItem[]);
					else setBidOrders((prev) => updateOrdersAfterAcceptOrder(prev, order) as IBidOrderItem[]);
				}

				// 주문 체결 케이스
				if (matchData && currentChart) {
					const { askOrders, bidOrders }: { askOrders: IAskOrderItem[]; bidOrders: IBidOrderItem[] } = bidAsk;

					setAskOrders(() => updateAskOrders(askOrders));
					setBidOrders(() => updateBidOrders(bidOrders));

					setStockList((prev) => updateTargetStock(prev, matchData, currentChart));
					addNewExecution(setStockExecution, data.match);

					Emitter.emit('order concluded', matchData.code);
				}
				setHold(await getHoldStocks());
				break;
			}
			case 'baseStock': {
				setStockExecution(dataToExecutionForm(data.conclusions));
				break;
			}
			case 'notice': {
				if (data.userType === 'bid')
					toast.success(
						<>
							<p>
								<b>{data.stockCode}</b>
							</p>
							<p>&nbsp;매수 주문 체결되었습니다.</p>
						</>,
					);
				if (data.userType === 'ask')
					toast.success(
						<>
							<p>
								<b>{data.stockCode}</b>
							</p>
							<p>&nbsp;매도 주문 체결되었습니다.</p>
						</>,
					);
				break;
			}
			default:
		}
	};
	Emitter.on('registerAlarm', (alarmToken: string) => {
		const alarmData = {
			type: 'alarm',
			alarmToken,
		};
		webSocket.send(translateRequestData(alarmData));
	});
};

const Socket = ({ children }: IProps) => {
	const setSocket = useSetRecoilState(webSocketAtom);
	const setStockList = useSetRecoilState(stockListAtom);
	const setAskOrders = useSetRecoilState(askOrdersAtom);
	const setBidOrders = useSetRecoilState(bidOrdersAtom);
	const setStockExecution = useSetRecoilState(stockExecutionAtom);
	const setHold = useSetRecoilState(HoldStockListAtom);

	startSocket({ setSocket, setStockList, setStockExecution, setAskOrders, setBidOrders, setHold });

	return <>{children}</>;
};

export default Socket;

import React from 'react';
import StockInfo, { Info } from './stockInfo/StockInfo';
import SideBar from './sideBar/SideBar';
import BidAsk from './bidAsk/BidAsk';
import './Trade.scss';

// interface Props {}

const info: Info = {
	name: '호눅스 코인',
	price: 1234567,
	percent: 1234,
	high: 1234,
	low: 1234,
	amount: 1234,
	volume: 1234567,
};

const Trade = () => {
	return (
		<main className="trade">
			<section className="trade-container">
				<aside className="aside-bar">
					<SideBar />
				</aside>
				<section className="trade-body">
					<section className="trade-info">
						<StockInfo info={info} />
					</section>
					<section className="trade-chart">chart</section>
					<section className="trade-status">
						<section className="trade-order">order</section>
						<section className="trade-bid-ask">
							<BidAsk />
						</section>
					</section>
					<section className="trade-conclusion">conclusion</section>
				</section>
			</section>
		</main>
	);
};

export default Trade;

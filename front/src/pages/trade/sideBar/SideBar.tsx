import React, { useState, useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import User from '@recoil/user/index';
import StockList, { IStockListItem } from '@recoil/stockList/index';
import SideBarItem from './sideBarItem/SideBarItem';

import './SideBar.scss';
import SearchBar from './searchbar/SearchBar';

export enum MENU {
	ALL = '전체',
	FAVORITE = '관심',
	HOLD = '보유',
}

// interface Props {}

const SideBar = () => {
	const [menu, setMenu] = useState(MENU.ALL);
	const userState = useRecoilValue(User);
	const stockListState = useRecoilValue(StockList);
	const [filteredStockListState, setFilteredStockListState] = useState<
		IStockListItem[]
	>([]);

	const [search, setSearch] = useState('');

	const searchEvent = (event: React.ChangeEvent<HTMLInputElement>) => {
		setSearch(event?.target?.value);
	};

	useEffect(() => {
		setFilteredStockListState(() => {
			switch (menu) {
				case MENU.FAVORITE:
					return stockListState.filter((stock: IStockListItem) =>
						userState.favorite.includes(stock.id),
					);
				case MENU.HOLD:
					return stockListState.filter((stock: IStockListItem) =>
						userState.hold.includes(stock.id),
					);
				default:
					return stockListState;
			}
		});
	}, [menu, stockListState, userState.favorite, userState.hold]);

	return (
		<div className="sidebar">
			<div className="sidebar__menu">
				<div
					className={`sidebar__menu-item ${
						menu === MENU.ALL ? 'selected' : ''
					}`}
					role="button"
					tabIndex={0}
					onClick={() => setMenu(MENU.ALL)}
					onKeyDown={() => setMenu(MENU.ALL)}
				>
					{MENU.ALL}
				</div>
				<div
					className={`sidebar__menu-item ${
						menu === MENU.FAVORITE ? 'selected' : ''
					}`}
					role="button"
					tabIndex={0}
					onClick={() => setMenu(MENU.FAVORITE)}
					onKeyDown={() => setMenu(MENU.FAVORITE)}
				>
					{MENU.FAVORITE}
				</div>
				<div
					className={`sidebar__menu-item ${
						menu === MENU.HOLD ? 'selected' : ''
					}`}
					role="button"
					tabIndex={0}
					onClick={() => setMenu(MENU.HOLD)}
					onKeyDown={() => setMenu(MENU.HOLD)}
				>
					{MENU.HOLD}
				</div>
			</div>
			<SearchBar searchEvent={searchEvent} />
			<div className="sidebar__legend">
				<div className="sidebar__legend-favorite" />
				<div className="sidebar__legend-name">이름</div>
				<div className="sidebar__legend-price">현재가</div>
				<div className="sidebar__legend-percent">전일대비</div>
				<div className="sidebar__legend-amount">거래대금</div>
			</div>
			<div className="sidebar__items">
				{filteredStockListState
					.filter((stock: IStockListItem) =>
						stock.code.startsWith(search),
					)
					.map((stock: IStockListItem) => (
						<SideBarItem
							key={stock.id}
							stock={stock}
							isFavorite={userState.favorite.includes(stock.id)}
						/>
					))}
			</div>
		</div>
	);
};

export default SideBar;

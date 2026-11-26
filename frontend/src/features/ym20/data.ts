export type TxStatus = 'Held' | 'Completed' | 'Refunded';

export interface Transaction {
  id: string;
  orderId: string;
  type: string;
  date: string;
  amount: number;
  status: TxStatus;
}

// Demo data: replace with API data later
export const transactions: Transaction[] = [
  { id: 'TX-3021', orderId: 'YM 1042', type: 'Funds held', date: '02 Nov 2026', amount: 184250, status: 'Held' },
  { id: 'TX-3018', orderId: 'YM 1041', type: 'Settlement', date: '31 Oct 2026', amount: 132000, status: 'Completed' },
  { id: 'TX-3012', orderId: 'YM 1038', type: 'Refund', date: '28 Oct 2026', amount: 9500, status: 'Refunded' },
  { id: 'TX-3005', orderId: 'YM 1035', type: 'Settlement', date: '25 Oct 2026', amount: 96000, status: 'Completed' },
];

export const formatLkr = (n: number) => `LKR ${n.toLocaleString('en-US')}`;

export const statusClass: Record<TxStatus, string> = {
  Held: 'bg-orange-100 text-orange-800',
  Completed: 'bg-green-100 text-green-900',
  Refunded: 'bg-gray-100 text-gray-700',
};

export interface TxExtra {
  reference: string;
  method: string;
  balanceAfter: number;
}

// Demo data: extra fields shown on the details page
export const txExtra: Record<string, TxExtra> = {
  'TX-3021': { reference: 'REF-88213', method: 'Agri wallet (simulated)', balanceAfter: 315750 },
  'TX-3018': { reference: 'REF-88102', method: 'Agri wallet (simulated)', balanceAfter: 500000 },
  'TX-3012': { reference: 'REF-87990', method: 'Agri wallet (simulated)', balanceAfter: 509500 },
  'TX-3005': { reference: 'REF-87855', method: 'Agri wallet (simulated)', balanceAfter: 413500 },
};

/** "YM 1042" becomes "YM-1042" so it can be used in a web address. */
export const orderSlug = (orderId: string) => orderId.replace(' ', '-');

export interface Grower {
  name: string;
  qty: number;
  unitPrice: number;
  fee: number;
}

export interface Order {
  id: string;
  produce: string;
  status: string;
  placed: string;
  address: string;
  expected: string;
  vehicle: string;
  payment: TxStatus;
  growers: Grower[];
}

// Demo data: keys match orderSlug(), e.g. "YM 1042" becomes "YM-1042"
export const orders: Record<string, Order> = {
  'YM-1042': {
    id: 'YM 1042', produce: 'Tomato · A', status: 'In transit', placed: '01 Nov 2026',
    address: 'Fresh Mart, Colombo', expected: '05 Nov 2026', vehicle: 'WP LO 4811', payment: 'Held',
    growers: [
      { name: 'Green Valley', qty: 400, unitPrice: 185, fee: 300 },
      { name: 'Highland Harvest', qty: 350, unitPrice: 185, fee: 263 },
      { name: 'Sunrise Organics', qty: 250, unitPrice: 185, fee: 187 },
    ],
  },
  'YM-1041': {
    id: 'YM 1041', produce: 'Carrot · A', status: 'Delivered', placed: '28 Oct 2026',
    address: 'Fresh Mart, Colombo', expected: '31 Oct 2026', vehicle: 'WP LO 4811', payment: 'Completed',
    growers: [{ name: 'Highland Harvest', qty: 600, unitPrice: 220, fee: 0 }],
  },
  'YM-1038': {
    id: 'YM 1038', produce: 'Cabbage · A', status: 'Cancelled', placed: '24 Oct 2026',
    address: 'Fresh Mart, Colombo', expected: '27 Oct 2026', vehicle: 'Not assigned', payment: 'Refunded',
    growers: [{ name: 'Green Valley', qty: 50, unitPrice: 190, fee: 0 }],
  },
  'YM-1035': {
    id: 'YM 1035', produce: 'Tomato · A', status: 'Delivered', placed: '21 Oct 2026',
    address: 'Fresh Mart, Colombo', expected: '25 Oct 2026', vehicle: 'WP LO 4811', payment: 'Completed',
    growers: [{ name: 'Sunrise Organics', qty: 400, unitPrice: 240, fee: 0 }],
  },
};

export const sum = (nums: number[]) => nums.reduce((a, b) => a + b, 0);
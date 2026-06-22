export const DEFAULT_CATEGORIES = [
  { id: 'groceries', name: 'Groceries', color: '#B8D4B0', sort_order: 0 },
  { id: 'coffee',    name: 'Coffee',    color: '#E0A872', sort_order: 1 },
  { id: 'dining',    name: 'Dining',    color: '#D9846A', sort_order: 2 },
  { id: 'transport', name: 'Transport', color: '#7FA6C8', sort_order: 3 },
  { id: 'travel',    name: 'Travel',    color: '#A47BB9', sort_order: 4 },
  { id: 'home',      name: 'Home',      color: '#E8C570', sort_order: 5 },
  { id: 'software',  name: 'Software',  color: '#6F8E63', sort_order: 6 },
  { id: 'health',    name: 'Health',    color: '#C9A0DC', sort_order: 7 },
  { id: 'other',     name: 'Other',     color: '#8F8A80', sort_order: 8 },
];

export const DEMO_TXNS = [
  { id: 't1',  merchant: 'Blue Bottle Coffee', category_id: 'coffee',    amount: 6.75,   date: '2026-05-07T08:14:00', note: 'oat latte',  currency: 'USD', confidence: 0.96 },
  { id: 't2',  merchant: 'Whole Foods Market', category_id: 'groceries', amount: 84.32,  date: '2026-05-06T18:22:00', note: null,         currency: 'USD', confidence: null },
  { id: 't3',  merchant: 'Lyft',               category_id: 'transport', amount: 14.20,  date: '2026-05-06T11:05:00', note: null,         currency: 'USD', confidence: null },
  { id: 't4',  merchant: 'Linear',             category_id: 'software',  amount: 16.00,  date: '2026-05-05T09:00:00', note: 'monthly',    currency: 'USD', confidence: null },
  { id: 't5',  merchant: 'Tartine Bakery',     category_id: 'dining',    amount: 22.50,  date: '2026-05-04T13:45:00', note: null,         currency: 'USD', confidence: null },
  { id: 't6',  merchant: 'Delta Airlines',     category_id: 'travel',    amount: 412.30, date: '2026-05-03T07:00:00', note: 'SFO → JFK', currency: 'USD', confidence: null },
  { id: 't7',  merchant: "Trader Joe's",       category_id: 'groceries', amount: 47.18,  date: '2026-05-02T17:33:00', note: null,         currency: 'USD', confidence: null },
  { id: 't8',  merchant: 'PG&E',               category_id: 'home',      amount: 92.40,  date: '2026-05-01T09:00:00', note: 'utilities',  currency: 'USD', confidence: null },
  { id: 't9',  merchant: 'Sightglass Coffee',  category_id: 'coffee',    amount: 5.50,   date: '2026-04-30T08:50:00', note: null,         currency: 'USD', confidence: null },
  { id: 't10', merchant: 'CVS Pharmacy',       category_id: 'health',    amount: 18.99,  date: '2026-04-29T19:10:00', note: null,         currency: 'USD', confidence: null },
  { id: 't11', merchant: 'Spotify',            category_id: 'software',  amount: 11.99,  date: '2026-04-28T00:00:00', note: null,         currency: 'USD', confidence: null },
  { id: 't12', merchant: 'Uber Eats',          category_id: 'dining',    amount: 31.40,  date: '2026-04-27T20:15:00', note: null,         currency: 'USD', confidence: null },
];

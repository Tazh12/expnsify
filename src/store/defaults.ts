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

function daysAgo(n: number, hour = 9, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const DEMO_TXNS = [
  { id: 't1',  merchant: 'Blue Bottle Coffee', category_id: 'coffee',    amount: 6.75,   date: daysAgo(2,  8, 14), note: 'oat latte',  currency: 'USD', confidence: 0.96 },
  { id: 't2',  merchant: 'Whole Foods Market', category_id: 'groceries', amount: 84.32,  date: daysAgo(3, 18, 22), note: null,         currency: 'USD', confidence: null },
  { id: 't3',  merchant: 'Lyft',               category_id: 'transport', amount: 14.20,  date: daysAgo(3, 11,  5), note: null,         currency: 'USD', confidence: null },
  { id: 't4',  merchant: 'Linear',             category_id: 'software',  amount: 16.00,  date: daysAgo(4,  9,  0), note: 'monthly',    currency: 'USD', confidence: null },
  { id: 't5',  merchant: 'Tartine Bakery',     category_id: 'dining',    amount: 22.50,  date: daysAgo(5, 13, 45), note: null,         currency: 'USD', confidence: null },
  { id: 't6',  merchant: 'Delta Airlines',     category_id: 'travel',    amount: 412.30, date: daysAgo(6,  7,  0), note: 'SFO → JFK', currency: 'USD', confidence: null },
  { id: 't7',  merchant: "Trader Joe's",       category_id: 'groceries', amount: 47.18,  date: daysAgo(7, 17, 33), note: null,         currency: 'USD', confidence: null },
  { id: 't8',  merchant: 'PG&E',               category_id: 'home',      amount: 92.40,  date: daysAgo(8,  9,  0), note: 'utilities',  currency: 'USD', confidence: null },
  { id: 't9',  merchant: 'Sightglass Coffee',  category_id: 'coffee',    amount: 5.50,   date: daysAgo(9,  8, 50), note: null,         currency: 'USD', confidence: null },
  { id: 't10', merchant: 'CVS Pharmacy',       category_id: 'health',    amount: 18.99,  date: daysAgo(10, 19, 10), note: null,        currency: 'USD', confidence: null },
  { id: 't11', merchant: 'Spotify',            category_id: 'software',  amount: 11.99,  date: daysAgo(11,  0,  0), note: null,        currency: 'USD', confidence: null },
  { id: 't12', merchant: 'Uber Eats',          category_id: 'dining',    amount: 31.40,  date: daysAgo(12, 20, 15), note: null,        currency: 'USD', confidence: null },
];

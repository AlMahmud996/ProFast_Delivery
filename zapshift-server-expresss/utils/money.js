export const roundMoney = (n) => Math.round(n * 100) / 100;

export const sumAmounts = (rows) => roundMoney(rows.reduce((total, r) => total + (Number(r.amount) || 0), 0));

// Hide most of an account number, e.g. 01712345678 -> *******5678
export const maskAccount = (acc) => (acc ? `${"*".repeat(Math.max(0, acc.length - 4))}${acc.slice(-4)}` : "");

export const publicCashout = (c) => ({ ...c, accountNumber: maskAccount(c.accountNumber) });

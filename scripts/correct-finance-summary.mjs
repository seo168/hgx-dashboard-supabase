const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

const url = process.env.SUPABASE_URL.replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
};

const depositTarget = {
  report_date: '2026-10-24',
  platform: '66GAME',
  channel: 'ALL',
  export_type: 'recharge',
};
const query = new URLSearchParams({
  select: 'id,amount,total_orders,successful_orders',
  report_date: `eq.${depositTarget.report_date}`,
  platform: `eq.${depositTarget.platform}`,
  channel: `eq.${depositTarget.channel}`,
  export_type: `eq.${depositTarget.export_type}`,
});

const currentResponse = await fetch(`${url}/rest/v1/finance_daily?${query}`, { headers });
if (!currentResponse.ok) throw new Error(await currentResponse.text());
const rows = await currentResponse.json();
if (rows.length !== 1) throw new Error(`Expected exactly one summary row, found ${rows.length}`);

const corrected = {
  amount: 7000900,
  total_orders: 23719,
  successful_orders: 23719,
  updated_at: new Date().toISOString(),
};
const updateResponse = await fetch(`${url}/rest/v1/finance_daily?id=eq.${rows[0].id}`, {
  method: 'PATCH',
  headers: { ...headers, Prefer: 'return=representation' },
  body: JSON.stringify(corrected),
});
if (!updateResponse.ok) throw new Error(await updateResponse.text());
const updated = await updateResponse.json();

const withdrawQuery = new URLSearchParams({
  select: 'id,amount,total_orders,successful_orders',
  report_date: 'eq.2026-10-24',
  platform: 'eq.66GAME',
  channel: 'eq.SUMMARY|WITHDRAW|ALL',
});
const withdrawCurrentResponse = await fetch(`${url}/rest/v1/finance_daily?${withdrawQuery}`, { headers });
if (!withdrawCurrentResponse.ok) throw new Error(await withdrawCurrentResponse.text());
const withdrawRows = await withdrawCurrentResponse.json();
if (withdrawRows.length > 1) throw new Error(`Expected at most one withdraw summary row, found ${withdrawRows.length}`);
const withdrawCorrected = {
  report_date: '2026-10-24',
  platform: '66GAME',
  channel: 'SUMMARY|WITHDRAW|ALL',
  amount: 5281930,
  total_orders: 9128,
  successful_orders: 9128,
  export_type: 'withdraw_summary',
  updated_at: new Date().toISOString(),
};
const withdrawResponse = await fetch(
  withdrawRows.length
    ? `${url}/rest/v1/finance_daily?id=eq.${withdrawRows[0].id}`
    : `${url}/rest/v1/finance_daily`,
  {
    method: withdrawRows.length ? 'PATCH' : 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(withdrawCorrected),
  },
);
if (!withdrawResponse.ok) throw new Error(await withdrawResponse.text());
const withdrawUpdated = await withdrawResponse.json();
console.log(JSON.stringify({
  deposit: { before: rows[0], after: updated[0] },
  withdraw: { before: withdrawRows[0] || null, after: withdrawUpdated[0] },
}, null, 2));

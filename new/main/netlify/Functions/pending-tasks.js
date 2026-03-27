// netlify/functions/pending-tasks.js
// Add this file to your handslogistics GitHub repo at:
// netlify/functions/pending-tasks.js

const MONDAY_API_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjYzNjEzNzc5MSwiYWFpIjoxMSwidWlkIjoxNDk4NzI0NSwiaWFkIjoiMjAyNi0wMy0yMlQxNzoyNTo1MC4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6NjYxOTgxNSwicmduIjoidXNlMSJ9.RLTGytTbLaran19E20Ag8nzxdaWuwVKVZNx3fdvAIBQ';
const BOARD_ID = '4550650855';
const DONE_STATUSES = ['COMPLETE', 'CANCELLED', 'Requestor to Return'];

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };

  const query = `{
    boards(ids: [${BOARD_ID}]) {
      items_page(limit: 500, query_params: {
        rules: [{ column_id: "date", compare_value: [], operator: is_not_empty }]
        operator: and
      }) {
        items {
          id name
          column_values(ids: ["date", "color", "text4"]) { id text }
        }
      }
    }
  }`;

  try {
    const res = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': MONDAY_API_TOKEN, 'API-Version': '2023-04' },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    if (data.errors) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: data.errors[0].message }) };

    const items = data.data.boards[0].items_page.items;
    const pending = items.filter(item => {
      const col = item.column_values.find(c => c.id === 'color');
      return !DONE_STATUSES.includes(col ? col.text : '');
    });
    pending.sort((a, b) => {
      const ad = (a.column_values.find(c => c.id === 'date') || {}).text || '';
      const bd = (b.column_values.find(c => c.id === 'date') || {}).text || '';
      return ad < bd ? -1 : ad > bd ? 1 : 0;
    });
    const top10 = pending.slice(0, 10).map(item => ({
      id: item.id, name: item.name,
      date:    (item.column_values.find(c => c.id === 'date')  || {}).text || '',
      status:  (item.column_values.find(c => c.id === 'color') || {}).text || '',
      account: (item.column_values.find(c => c.id === 'text4') || {}).text || ''
    }));
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ total: pending.length, items: top10 }) };
  } catch (err) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};

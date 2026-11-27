const base = 'http://127.0.0.1:5000/api';

async function call(method, path, token, body) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status} ${json.error || ''}`);
    err.payload = json;
    throw err;
  }
  return json;
}

const login = await call('POST', '/auth/demo-login', null, { role: 'buyer' });
const token = login.token;
const status = await call('GET', '/ym16/status', token);
const reservations = await call('GET', '/ym16/reservations', token);
const wallet = await call('GET', '/ym16/wallet', token);
console.log('status', status.status);
console.log('reservations', reservations.reservations.length);
console.log('wallet', wallet.availableCents, wallet.heldCents);
console.log('ok');

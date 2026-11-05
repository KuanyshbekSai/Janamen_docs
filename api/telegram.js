export default async function handler(req, res) {
  // Telegram expects 200 OK
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'Jana Men Docs Telegram Proxy', status: 'ready' });
  }

  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true });
  }

  var update = req.body;
  
  // Forward to Google Apps Script without letting Telegram wait or receive a 302
  var gasUrl = 'https://script.google.com/macros/s/AKfycbwybaGgxGCnIHrWHz1UeL1sNNUU1uGGXXC4qVBDueuO3WmkPO0cLZyuELEYbXl1jYzYgw/exec';

  try {
    if (update) {
      await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
        redirect: 'follow'
      });
    }
  } catch (err) {
    console.error('Telegram Proxy Forward Error:', err);
  }

  return res.status(200).json({ ok: true });
}

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
  var gasUrl = 'https://script.google.com/macros/s/AKfycbzOhjF0uFfxA7gtL_bVVac1p_dR3jxbRKUb-VpmcygpDG6QEyGZDgQYYJEMmWSReZhZ4Q/exec';

  try {
    if (update) {
      await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
        redirect: 'follow',
        signal: AbortSignal.timeout ? AbortSignal.timeout(9000) : undefined
      });
    }
  } catch (err) {
    console.error('Telegram Proxy Forward Error:', err);
  }

  return res.status(200).json({ ok: true });
}

// functions/contact.js
export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();

    // ① Forward to the Apps Script webhook to send the mail
    const r = await fetch(env.GAS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!r.ok) {
      console.log('GAS error', r.status, await r.text());
      return new Response('email_error', { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.log('server_error', err);
    return new Response('server_error', { status: 500 });
  }
}

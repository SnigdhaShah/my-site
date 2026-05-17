export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    return res.json({ error: 'env vars missing', url: !!url, key: !!key });
  }

  const endpoint = `${url}/rest/v1/leads`;
  const testRow = {
    company: 'TEST',
    email: 'test@test.com',
    score: 'LOW',
    status: 'test',
  };

  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(testRow),
    });
    const body = await r.text();
    return res.json({
      status: r.status,
      ok: r.ok,
      body: body.slice(0, 500),
      url_used: endpoint,
      key_preview: key.slice(0, 20) + '...',
    });
  } catch (e) {
    return res.json({ error: e.message });
  }
}

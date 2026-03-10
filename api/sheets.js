export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
  if (!GOOGLE_SCRIPT_URL) {
    return new Response(JSON.stringify({ error: 'GOOGLE_SCRIPT_URL not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const body = await req.text();

    // Apps Script returns a 302 redirect to the response URL.
    // Using redirect:'follow' converts POST to GET on the redirect, which breaks.
    // Instead, handle the redirect manually: POST (get 302), then GET the redirect URL.
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      redirect: 'manual',
    });

    if (response.status === 302) {
      const redirectUrl = response.headers.get('location');
      if (redirectUrl) {
        const redirectResponse = await fetch(redirectUrl);
        const result = await redirectResponse.text();
        return new Response(result, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    const result = await response.text();
    return new Response(JSON.stringify({ status: 'proxy_response', httpStatus: response.status, body: result }), {
      status: response.ok ? 200 : 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

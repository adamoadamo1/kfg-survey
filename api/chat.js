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

  const body = await req.json();

  const messages = [];
  if (body.system) {
    messages.push({ role: 'system', content: body.system });
  }
  messages.push(...body.messages);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': req.headers.get('origin') || 'https://kfg-survey.vercel.app',
      'X-Title': 'KFG Positioning Survey',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-preview',
      max_tokens: body.max_tokens || 300,
      temperature: body.temperature || 0.7,
      messages: messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    return new Response(JSON.stringify({ error: 'Upstream API error', status: response.status, detail: errorBody }), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

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
      model: 'anthropic/claude-sonnet-4',
      max_tokens: body.max_tokens || 500,
      temperature: 0.3,
      messages: messages,
      stream: false,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  return new Response(JSON.stringify({ content }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

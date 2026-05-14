const https = require('https');

function anthropicToGemini(body) {
  const systemPrompt = body.system || '';
  const messages = body.messages || [];
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  return {
    system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    contents,
    generationConfig: { maxOutputTokens: body.max_tokens || 1000, temperature: 0.7 }
  };
}

function geminiToAnthropic(geminiResponse) {
  const text = geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { content: [{ type: 'text', text }] };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'API key de Gemini no configurada' }) };
  }

  try {
    const anthropicBody = JSON.parse(event.body);
    const geminiBody = anthropicToGemini(anthropicBody);
    if (!geminiBody.system_instruction) delete geminiBody.system_instruction;

    const requestBody = JSON.stringify(geminiBody);
    const path = `/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(requestBody) }
      };
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(new Error('Respuesta invalida')); } });
      });
      req.on('error', reject);
      req.write(requestBody);
      req.end();
    });

    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(geminiToAnthropic(data)) };

  } catch (err) {
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: err.message }) };
  }
};

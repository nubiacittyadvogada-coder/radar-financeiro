import { NextRequest } from 'next/server'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const start = Date.now()
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ erro: 'sem API key' })

  // Teste 1: DNS/conectividade com fetch direto
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 20,
        messages: [{ role: 'user', content: 'Say: OK' }],
      }),
    })
    const ms = Date.now() - start
    const body = await res.json()
    return Response.json({ ok: res.ok, status: res.status, body, ms })
  } catch (err: any) {
    const ms = Date.now() - start
    return Response.json({ fetchError: err.message, tipo: err.constructor?.name, ms, cause: String(err.cause) }, { status: 500 })
  }
}

import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const start = Date.now()
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return Response.json({ erro: 'sem API key' })

    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Diga apenas: OK' }],
    })

    const ms = Date.now() - start
    return Response.json({ ok: true, resposta: msg.content[0], ms })
  } catch (err: any) {
    const ms = Date.now() - start
    return Response.json({ erro: err.message, tipo: err.constructor?.name, ms, stack: err.stack?.slice(0, 300) }, { status: 500 })
  }
}

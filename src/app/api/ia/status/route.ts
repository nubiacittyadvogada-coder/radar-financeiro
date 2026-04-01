export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY
  return Response.json({ configurada: !!key, prefixo: key ? key.substring(0, 20) + '...' : null })
}

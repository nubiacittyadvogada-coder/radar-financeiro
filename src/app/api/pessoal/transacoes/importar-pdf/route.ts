import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'

export const maxDuration = 60

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return Response.json({ erro: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return Response.json({ erro: 'Arquivo não enviado' }, { status: 400 })

    // Lê o PDF como buffer e extrai texto
    const buffer = Buffer.from(await file.arrayBuffer())

    // Usa pdf-parse para extrair texto
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse.js')
    const pdfData = await pdfParse(buffer)
    const texto = pdfData.text

    if (!texto || texto.trim().length < 50) {
      return Response.json({ erro: 'Não foi possível extrair texto do PDF. Verifique se o arquivo não é um scan.' }, { status: 400 })
    }

    // Limita o texto para não estourar tokens (máx ~8000 chars)
    const textoLimitado = texto.slice(0, 8000)

    const prompt = `Você é um especialista em extrair transações financeiras de extratos bancários e faturas de cartão de crédito brasileiros.

Analise o texto abaixo e extraia TODAS as transações financeiras encontradas.

REGRAS:
- "tipo" deve ser "receita" (crédito, depósito, transferência recebida, Pix recebido, salário, rendimento) ou "despesa" (débito, compra, pagamento, transferência enviada, Pix enviado, tarifa, taxa)
- "valor" deve ser número positivo (sem sinal)
- "data" no formato YYYY-MM-DD
- "descricao" deve ser o nome do estabelecimento/descrição da transação
- "categoria" deve ser uma das opções: Moradia, Alimentação, Transporte, Saúde, Educação, Lazer, Vestuário, Serviços / Assinaturas, Impostos pessoais, Investimentos, Salário, Freelance / Consultoria, Outros
- Se não conseguir identificar a data do ano, use o ano atual (2026)
- Ignore totais, saldos e linhas de cabeçalho

TEXTO DO EXTRATO:
${textoLimitado}

Responda APENAS com JSON válido:
{
  "banco": "nome do banco ou cartão identificado",
  "periodo": "período identificado ex: Março/2026",
  "transacoes": [
    {"data": "2026-03-05", "descricao": "Mercado Extra", "tipo": "despesa", "valor": 150.50, "categoria": "Alimentação"},
    {"data": "2026-03-01", "descricao": "Salário", "tipo": "receita", "valor": 5000.00, "categoria": "Salário"}
  ],
  "observacoes": "qualquer informação relevante sobre o extrato"
}`

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: '{' },
        ],
      }),
    })

    const aiData = await res.json()
    const text = '{' + (aiData.content?.[0]?.text ?? '{}')

    let resultado: any = {}
    try {
      resultado = JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) try { resultado = JSON.parse(match[0]) } catch {}
    }

    if (!resultado.transacoes || !Array.isArray(resultado.transacoes)) {
      return Response.json({ erro: 'Não foi possível identificar transações neste PDF.' }, { status: 422 })
    }

    return Response.json({
      banco: resultado.banco || 'Desconhecido',
      periodo: resultado.periodo || '',
      observacoes: resultado.observacoes || '',
      transacoes: resultado.transacoes,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

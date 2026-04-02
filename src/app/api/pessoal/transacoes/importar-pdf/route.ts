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

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return Response.json({ erro: 'Apenas arquivos PDF são aceitos' }, { status: 400 })
    }

    // Converte o PDF para base64
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // Envia o PDF diretamente para Claude (suporte nativo a PDF)
    const prompt = `Analise este extrato bancário/fatura e extraia TODAS as transações financeiras.

REGRAS:
- "tipo" deve ser "receita" (crédito, depósito, PIX recebido, transferência recebida, salário, rendimento) ou "despesa" (débito, PIX enviado/pagamento, compra, tarifa, taxa, IOF, juros)
- "valor" deve ser número positivo (sem sinal)
- "data" no formato YYYY-MM-DD
- "descricao" deve ser o nome limpo do estabelecimento ou tipo de transação (remova números de documento, CPF/CNPJ longos)
- "categoria" deve ser uma das opções: Moradia, Alimentação, Transporte, Saúde, Educação, Lazer, Vestuário, Serviços / Assinaturas, Impostos pessoais, Investimentos, Salário, Freelance / Consultoria, Outros
- Ignore linhas de saldo inicial/final, totais e cabeçalhos
- Se não conseguir identificar o ano na data, use o ano que aparece no documento

Responda APENAS com JSON válido (sem markdown):
{
  "banco": "nome do banco identificado",
  "periodo": "período ex: Fevereiro/2026",
  "transacoes": [
    {"data": "2026-02-02", "descricao": "Christiane Sgarbi", "tipo": "despesa", "valor": 259.00, "categoria": "Outros"},
    {"data": "2026-02-04", "descricao": "Recebimento PIX Sicredi", "tipo": "receita", "valor": 25000.00, "categoria": "Outros"}
  ],
  "observacoes": "informações relevantes"
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
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
          {
            role: 'assistant',
            content: '{',
          },
        ],
      }),
    })

    const aiData = await res.json()

    if (aiData.error) {
      return Response.json({ erro: aiData.error.message || 'Erro na API de IA' }, { status: 500 })
    }

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

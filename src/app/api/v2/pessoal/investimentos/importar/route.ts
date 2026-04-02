import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export const maxDuration = 60

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return Response.json({ erro: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })

    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return Response.json({ erro: 'Arquivo não enviado' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const prompt = `Analise este extrato de investimento e extraia as informações do produto.

Responda APENAS com JSON válido (sem markdown):
{
  "produto": "SICREDINVEST CDI100",
  "titulo": "8520501636-5",
  "indexador": "CDI",
  "remuneracao": "100% CDI",
  "tributacao": "Incide IRRF e IOF",
  "valorInicial": 7000.00,
  "dataAplicacao": "2026-03-17",
  "vencimento": "2029-03-01",
  "carencia": "2026-06-15",
  "saldoAtual": 7000.00,
  "rendimentosProvisionados": 0.00,
  "liquidoSaque": 7000.00
}

Regras:
- Datas no formato YYYY-MM-DD
- Valores numéricos sem R$ ou pontos de milhar
- Se vencimento ou carência não existir, use null
- titulo = código do título (ex: 8520501636-5)`

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              { type: 'text', text: prompt },
            ],
          },
          { role: 'assistant', content: '{' },
        ],
      }),
    })

    const aiData = await res.json()
    if (aiData.error) return Response.json({ erro: aiData.error.message }, { status: 500 })

    const text = '{' + (aiData.content?.[0]?.text ?? '{}')
    let dados: any = {}
    try { dados = JSON.parse(text) } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) try { dados = JSON.parse(match[0]) } catch {}
    }

    if (!dados.produto || !dados.valorInicial) {
      return Response.json({ erro: 'Não foi possível identificar o produto de investimento.' }, { status: 422 })
    }

    // Upsert: atualiza se já existe (mesmo título), cria se novo
    const chave = dados.titulo || dados.produto
    const investimento = await prisma.investimentoPessoal.upsert({
      where: { contaPessoalId_titulo: { contaPessoalId: conta.id, titulo: chave } },
      create: {
        contaPessoalId: conta.id,
        produto: dados.produto,
        titulo: chave,
        indexador: dados.indexador || null,
        remuneracao: dados.remuneracao || null,
        tributacao: dados.tributacao || null,
        valorInicial: dados.valorInicial,
        dataAplicacao: new Date(dados.dataAplicacao),
        vencimento: dados.vencimento ? new Date(dados.vencimento) : null,
        carencia: dados.carencia ? new Date(dados.carencia) : null,
        saldoAtual: dados.saldoAtual,
        rendimentosProvisionados: dados.rendimentosProvisionados || 0,
        liquidoSaque: dados.liquidoSaque,
        atualizadoEm: new Date(),
      },
      update: {
        saldoAtual: dados.saldoAtual,
        rendimentosProvisionados: dados.rendimentosProvisionados || 0,
        liquidoSaque: dados.liquidoSaque,
        atualizadoEm: new Date(),
      },
    })

    return Response.json({ ok: true, investimento })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

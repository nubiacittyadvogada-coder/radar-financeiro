import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export const maxDuration = 60

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const { clienteId } = await req.json()
    if (!clienteId) return Response.json({ erro: 'clienteId obrigatório' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return Response.json({ erro: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })

    // Últimos 3 meses de dados
    const transacoes = await prisma.lancamentoManual.findMany({
      where: { clienteId, grupoConta: { startsWith: 'pessoal' } },
      orderBy: { data: 'desc' },
      take: 200,
    })

    if (transacoes.length === 0) {
      return Response.json({ analise: 'Ainda não há transações registradas. Adicione suas receitas e despesas para receber uma análise.' })
    }

    const fmt = (v: number) => `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

    const receitas = transacoes.filter(t => t.tipo === 'receita').reduce((s, t) => s + Number(t.valor), 0)
    const despesas = transacoes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + Math.abs(Number(t.valor)), 0)
    const saldo = receitas - despesas

    const porCategoria: Record<string, number> = {}
    transacoes.filter(t => t.tipo === 'despesa').forEach(t => {
      porCategoria[t.planoConta] = (porCategoria[t.planoConta] || 0) + Math.abs(Number(t.valor))
    })

    const porCartao: Record<string, number> = {}
    transacoes.filter(t => t.grupoConta === 'pessoal_cartao').forEach(t => {
      const c = t.tipoContabil || 'Sem nome'
      porCartao[c] = (porCartao[c] || 0) + Math.abs(Number(t.valor))
    })

    const topCategorias = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).slice(0, 8)
    const topCartoes = Object.entries(porCartao).sort((a, b) => b[1] - a[1])

    const prompt = `Você é um consultor de finanças pessoais. Analise os dados abaixo e dê conselhos práticos e diretos para melhorar a saúde financeira pessoal.
Use linguagem simples, sem jargão. Seja específico com os números.

RESUMO FINANCEIRO PESSOAL:
Total de Receitas: ${fmt(receitas)}
Total de Despesas: ${fmt(despesas)}
Saldo: ${fmt(saldo)} ${saldo >= 0 ? '(positivo)' : '(NEGATIVO)'}
Taxa de poupança: ${receitas > 0 ? ((saldo / receitas) * 100).toFixed(1) : 0}%

GASTOS POR CATEGORIA:
${topCategorias.map(([cat, val]) => `${cat}: ${fmt(val)} (${receitas > 0 ? ((val / receitas) * 100).toFixed(1) : 0}% da renda)`).join('\n')}

${topCartoes.length > 0 ? `GASTOS NO CARTÃO DE CRÉDITO:\n${topCartoes.map(([c, v]) => `${c}: ${fmt(v)}`).join('\n')}` : ''}

Responda APENAS com JSON válido (sem markdown):
{
  "diagnostico": "2 parágrafos sobre a situação financeira atual",
  "pontosCriticos": ["problema 1 com números", "problema 2", "problema 3"],
  "dicas": [{"titulo": "nome", "descricao": "ação concreta", "impacto": "quanto pode economizar"}],
  "metaPoupanca": {"percentual": 0, "valorMensal": 0, "justificativa": "por quê esse valor"},
  "alertasCartao": ["alerta 1 se gasto em cartão for alto", "alerta 2"],
  "mensagem": "frase motivacional final"
}`

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': apiKey },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: '{' },
        ],
      }),
    })

    const aiData = await res.json()
    const text = '{' + (aiData.content?.[0]?.text ?? '{}')

    let analise: any = { diagnostico: text }
    try {
      analise = JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) try { analise = JSON.parse(match[0]) } catch {}
    }

    return Response.json({ analise, stats: { receitas, despesas, saldo, porCategoria, porCartao } })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

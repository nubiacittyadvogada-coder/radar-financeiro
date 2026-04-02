import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export const maxDuration = 60

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

// POST /api/v2/pessoal/metas/[id]/estrategia — gera estratégia IA (uma vez)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return Response.json({ erro: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })

    const meta = await prisma.metaPessoal.findUnique({ where: { id: params.id } })
    if (!meta) return Response.json({ erro: 'Meta não encontrada' }, { status: 404 })

    // Se já gerou, retorna a existente
    if (meta.estrategiaGerada && meta.estrategiaIA) {
      return Response.json({ estrategia: JSON.parse(meta.estrategiaIA), jaExistia: true })
    }

    // Busca contexto financeiro
    const conta = await prisma.contaPessoal.findUnique({ where: { id: meta.contaPessoalId } })
    const usuario = await prisma.usuario.findUnique({ where: { id: u.id } })

    const mesAtual = new Date().getMonth() + 1
    const anoAtual = new Date().getFullYear()

    const transacoes = await prisma.transacaoPessoal.findMany({
      where: { contaPessoalId: meta.contaPessoalId, ano: anoAtual },
      select: { tipo: true, valor: true, mes: true },
    })

    const rendaMensal = transacoes
      .filter((t) => t.tipo === 'receita')
      .reduce((s, t) => s + Number(t.valor), 0) / Math.max(1, new Set(transacoes.map((t) => t.mes)).size)

    const gastoMensal = transacoes
      .filter((t) => t.tipo === 'despesa')
      .reduce((s, t) => s + Number(t.valor), 0) / Math.max(1, new Set(transacoes.map((t) => t.mes)).size)

    const economiaMedia = rendaMensal - gastoMensal
    const valorFaltando = Number(meta.valorMeta) - Number(meta.valorAtual)
    const prazoMeses = meta.prazo
      ? Math.max(1, Math.ceil((new Date(meta.prazo).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)))
      : 12

    const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

    const prompt = `Você é uma conselheira financeira pessoal. Crie uma estratégia detalhada para ajudar ${usuario?.nome || 'o usuário'} a atingir a meta financeira abaixo.

META:
- Título: ${meta.titulo}
${meta.descricao ? `- Descrição: ${meta.descricao}` : ''}
- Valor total: ${fmt(Number(meta.valorMeta))}
- Já guardado: ${fmt(Number(meta.valorAtual))}
- Falta: ${fmt(valorFaltando)}
- Prazo: ${prazoMeses} meses${meta.prazo ? ` (até ${new Date(meta.prazo).toLocaleDateString('pt-BR')})` : ''}

CONTEXTO FINANCEIRO (média mensal):
- Renda: ${fmt(rendaMensal)}
- Gastos: ${fmt(gastoMensal)}
- Capacidade atual de poupança: ${fmt(economiaMedia)}

Crie uma estratégia em JSON com esta estrutura exata:
{
  "resumo": "frase motivacional de 1 linha sobre a meta",
  "possivel": true/false,
  "por_mes_necessario": valor numérico (quanto poupar por mês),
  "tempo_estimado": "Ex: 8 meses",
  "passos": [
    {"titulo": "Passo 1", "descricao": "instrução prática e específica"},
    {"titulo": "Passo 2", "descricao": "..."}
  ],
  "alertas": ["aviso 1 se houver risco ou ajuste necessário"],
  "dica_extra": "uma dica personalizada para acelerar a meta"
}

Responda APENAS com o JSON válido, sem markdown.`

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: '{' },
        ],
      }),
    })

    const aiData = await res.json()
    if (aiData.error) return Response.json({ erro: aiData.error.message }, { status: 500 })

    const text = '{' + (aiData.content?.[0]?.text ?? '{}')
    let estrategia: any = {}
    try {
      estrategia = JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) try { estrategia = JSON.parse(match[0]) } catch {}
    }

    // Salva no banco (uma vez)
    await prisma.metaPessoal.update({
      where: { id: params.id },
      data: { estrategiaIA: JSON.stringify(estrategia), estrategiaGerada: true },
    })

    return Response.json({ estrategia })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

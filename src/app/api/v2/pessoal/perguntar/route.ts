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
    if (!conta) return Response.json({ erro: 'Conta pessoal não encontrada' }, { status: 404 })

    const { pergunta, mes, ano } = await req.json()
    if (!pergunta) return Response.json({ erro: 'pergunta obrigatória' }, { status: 400 })

    const usuario = await prisma.usuario.findUnique({ where: { id: u.id } })
    const mesAtual = mes || new Date().getMonth() + 1
    const anoAtual = ano || new Date().getFullYear()

    // Contexto financeiro
    const transacoesMes = await prisma.transacaoPessoal.findMany({
      where: { contaPessoalId: conta.id, mes: mesAtual, ano: anoAtual },
      include: { categoria: true },
    })

    const orcamentos = await prisma.orcamentoPessoal.findMany({
      where: { contaPessoalId: conta.id, mes: mesAtual, ano: anoAtual },
      include: { categoria: true },
    })

    const metas = await prisma.metaPessoal.findMany({
      where: { contaPessoalId: conta.id, status: 'ativa' },
    })

    const historico = await prisma.transacaoPessoal.findMany({
      where: { contaPessoalId: conta.id, ano: anoAtual },
      select: { mes: true, tipo: true, valor: true },
    })

    const fmt = (v: any) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

    const totalRec = transacoesMes.filter((t) => t.tipo === 'receita').reduce((s, t) => s + Number(t.valor), 0)
    const totalDesp = transacoesMes.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + Number(t.valor), 0)

    // Por categoria
    const catMap = new Map<string, number>()
    for (const t of transacoesMes.filter((t) => t.tipo === 'despesa')) {
      const nome = t.categoria?.nome || 'Outros'
      catMap.set(nome, (catMap.get(nome) || 0) + Number(t.valor))
    }
    const catOrdenadas = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6)

    const contexto = `FINANÇAS PESSOAIS DE ${usuario?.nome?.toUpperCase()} — ${mesAtual}/${anoAtual}

RESUMO DO MÊS:
- Receitas: ${fmt(totalRec)}
- Despesas: ${fmt(totalDesp)}
- Saldo: ${fmt(totalRec - totalDesp)}

MAIORES GASTOS:
${catOrdenadas.map(([cat, val]) => `- ${cat}: ${fmt(val)}`).join('\n')}

${orcamentos.length > 0 ? `ORÇAMENTOS:
${orcamentos.map((o) => `- ${o.categoria?.nome}: ${fmt(o.valorGasto)}/${fmt(o.valorMeta)} (${Math.round(Number(o.valorGasto) / Number(o.valorMeta) * 100)}%)`).join('\n')}` : ''}

${metas.length > 0 ? `METAS ATIVAS:
${metas.map((m) => `- ${m.titulo}: ${fmt(m.valorAtual)}/${fmt(m.valorMeta)} (${Math.round(Number(m.valorAtual) / Number(m.valorMeta) * 100)}%)`).join('\n')}` : ''}`

    const systemPrompt = `Você é uma conselheira financeira pessoal de ${usuario?.nome || 'usuário'}.
Seja empática, direta e prática. Dê conselhos personalizados baseados nos dados reais.
Responda sempre em português brasileiro. Máximo 300 palavras.`

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: `${contexto}\n\nPERGUNTA: ${pergunta}` }],
      }),
    })

    const aiData = await res.json()
    if (aiData.error) return Response.json({ erro: aiData.error.message }, { status: 500 })
    const resposta = aiData.content?.[0]?.text || 'Sem resposta'

    await prisma.conversaIAPessoal.create({
      data: {
        contaPessoalId: conta.id,
        pergunta,
        resposta,
        contextoMes: mesAtual,
        contextoAno: anoAtual,
      },
    })

    return Response.json({ resposta })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json([])
    const hist = await prisma.conversaIAPessoal.findMany({
      where: { contaPessoalId: conta.id },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    })
    return Response.json(hist)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

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

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const { pergunta, mes, ano } = await req.json()
    if (!pergunta) return Response.json({ erro: 'pergunta obrigatória' }, { status: 400 })

    const mesAtual = mes || new Date().getMonth() + 1
    const anoAtual = ano || new Date().getFullYear()

    // Busca dados financeiros para contexto
    const fechamento = await prisma.fechamentoEmpresa.findUnique({
      where: { contaEmpresaId_mes_ano: { contaEmpresaId: conta.id, mes: mesAtual, ano: anoAtual } },
    })

    const historico = await prisma.fechamentoEmpresa.findMany({
      where: { contaEmpresaId: conta.id },
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
      take: 6,
    })

    const contasPendentes = await prisma.contaPagarEmpresa.findMany({
      where: { contaEmpresaId: conta.id, status: 'pendente' },
      orderBy: { vencimento: 'asc' },
      take: 20,
    })

    const fmt = (v: any) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    const contexto = fechamento
      ? `DADOS DO MÊS ${mesAtual}/${anoAtual}:
Receita Bruta: ${fmt(fechamento.receitaBruta)}
Receita Líquida: ${fmt(fechamento.receitaLiquida)}
Custos Diretos: ${fmt(fechamento.custosDiretos)}
Margem de Contribuição: ${fmt(fechamento.margemContribuicao)} (${Number(fechamento.percMargem).toFixed(1)}%)
Despesas ADM: ${fmt(fechamento.totalDespesasAdm)}
Lucro Operacional: ${fmt(fechamento.lucroOperacional)} (${Number(fechamento.percLucroOp).toFixed(1)}%)
Retirada Sócios: ${fmt(fechamento.retiradaSocios)}
Lucro Líquido: ${fmt(fechamento.lucroLiquido)} (${Number(fechamento.percLucroLiq).toFixed(1)}%)
Resultado Caixa: ${fmt(fechamento.resultadoCaixa)}

HISTÓRICO (últimos ${historico.length} meses):
${historico.map((h) => `${h.mes}/${h.ano}: Receita ${fmt(h.receitaBruta)}, Lucro ${fmt(h.lucroLiquido)}`).join('\n')}

CONTAS A PAGAR PENDENTES:
${contasPendentes.map((c) => `- ${c.descricao}: ${fmt(c.valor)} (venc. ${new Date(c.vencimento).toLocaleDateString('pt-BR')})`).join('\n')}`
      : `Não há dados financeiros para ${mesAtual}/${anoAtual}. Apenas ${historico.length} meses anteriores disponíveis.
${historico.map((h) => `${h.mes}/${h.ano}: Receita ${fmt(h.receitaBruta)}, Lucro ${fmt(h.lucroLiquido)}`).join('\n')}`

    const systemPrompt = `Você é um conselheiro financeiro especializado em gestão empresarial para a empresa "${conta.nomeEmpresa}".
Analise os dados reais da empresa e responda de forma direta, prática e acionável.
Foque em insights estratégicos, não apenas em repetir números.
Responda sempre em português brasileiro.`

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `${contexto}\n\nPERGUNTA: ${pergunta}`,
          },
        ],
      }),
    })

    const aiData = await res.json()
    if (aiData.error) return Response.json({ erro: aiData.error.message }, { status: 500 })

    const resposta = aiData.content?.[0]?.text || 'Sem resposta'

    // Salva conversa
    await prisma.conversaIAEmpresa.create({
      data: {
        contaEmpresaId: conta.id,
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
    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json([])

    const historico = await prisma.conversaIAEmpresa.findMany({
      where: { contaEmpresaId: conta.id },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    })
    return Response.json(historico)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

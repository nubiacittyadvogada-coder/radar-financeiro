import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ totalAplicado: 0, totalResgatado: 0, saldoEstimado: 0, movimentos: [] })

    const { searchParams } = new URL(req.url)
    const ano = Number(searchParams.get('ano') || new Date().getFullYear())

    // Busca TODAS as transações de investimento (todos os anos, para calcular saldo acumulado)
    const todasAplicacoes = await prisma.transacaoPessoal.findMany({
      where: {
        contaPessoalId: conta.id,
        categoria: { nome: 'Investimentos' },
        tipo: 'despesa', // aplicações saem da conta
        origem: { not: 'cartao' },
      },
      select: { valor: true, data: true, mes: true, ano: true, descricao: true },
      orderBy: [{ ano: 'asc' }, { mes: 'asc' }, { data: 'asc' }],
    })

    const todosResgates = await prisma.transacaoPessoal.findMany({
      where: {
        contaPessoalId: conta.id,
        categoria: { nome: 'Investimentos' },
        tipo: 'receita', // resgates entram na conta
        origem: { not: 'cartao' },
      },
      select: { valor: true, data: true, mes: true, ano: true, descricao: true },
      orderBy: [{ ano: 'asc' }, { mes: 'asc' }, { data: 'asc' }],
    })

    const totalAplicadoHistorico = todasAplicacoes.reduce((s, t) => s + Number(t.valor), 0)
    const totalResgatadoHistorico = todosResgates.reduce((s, t) => s + Number(t.valor), 0)
    const saldoEstimado = totalAplicadoHistorico - totalResgatadoHistorico

    // Filtrar pelo ano selecionado para o resumo do ano
    const aplicacoesAno = todasAplicacoes.filter((t) => t.ano === ano)
    const resgatesAno = todosResgates.filter((t) => t.ano === ano)
    const totalAplicadoAno = aplicacoesAno.reduce((s, t) => s + Number(t.valor), 0)
    const totalResgatadoAno = resgatesAno.reduce((s, t) => s + Number(t.valor), 0)

    // Agrupar por mês para o gráfico (ano selecionado)
    const porMes: Record<number, { aplicado: number; resgatado: number }> = {}
    for (let m = 1; m <= 12; m++) porMes[m] = { aplicado: 0, resgatado: 0 }
    aplicacoesAno.forEach((t) => { porMes[t.mes].aplicado += Number(t.valor) })
    resgatesAno.forEach((t) => { porMes[t.mes].resgatado += Number(t.valor) })

    // Movimentos do ano (todos juntos, ordenados por data)
    const movimentos = [
      ...aplicacoesAno.map((t) => ({ ...t, tipo: 'aplicacao' as const, valor: Number(t.valor) })),
      ...resgatesAno.map((t) => ({ ...t, tipo: 'resgate' as const, valor: Number(t.valor) })),
    ].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())

    // Posições de investimento cadastradas
    const posicoes = await prisma.investimentoPessoal.findMany({
      where: { contaPessoalId: conta.id },
      orderBy: { dataAplicacao: 'desc' },
    })

    return Response.json({
      totalAplicadoAno,
      totalResgatadoAno,
      saldoLiquidoAno: totalAplicadoAno - totalResgatadoAno,
      saldoEstimado, // acumulado histórico
      porMes,
      movimentos,
      posicoes,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

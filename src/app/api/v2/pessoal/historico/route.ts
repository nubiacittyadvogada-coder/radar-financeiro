import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

// GET /api/v2/pessoal/historico?meses=6
export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json([])

    const { searchParams } = new URL(req.url)
    const meses = Number(searchParams.get('meses') || 6)

    // Busca transações agrupadas por mês/ano
    const transacoes = await prisma.transacaoPessoal.findMany({
      where: { contaPessoalId: conta.id },
      select: { mes: true, ano: true, tipo: true, valor: true, origem: true },
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
    })

    // Agrupa — cartão fica separado para não duplicar com PAGTO FATURA do extrato
    const grupos = new Map<string, { mes: number; ano: number; receitas: number; despesas: number; cartao: number }>()
    for (const t of transacoes) {
      const key = `${t.ano}-${t.mes}`
      if (!grupos.has(key)) grupos.set(key, { mes: t.mes, ano: t.ano, receitas: 0, despesas: 0, cartao: 0 })
      const g = grupos.get(key)!
      if (t.origem === 'cartao') {
        g.cartao += Number(t.valor)
      } else if (t.tipo === 'receita') {
        g.receitas += Number(t.valor)
      } else {
        g.despesas += Number(t.valor)
      }
    }

    const resultado = Array.from(grupos.values())
      .sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes)
      .slice(-meses)
      .map((g) => ({ ...g, saldo: g.receitas - g.despesas }))

    return Response.json(resultado)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

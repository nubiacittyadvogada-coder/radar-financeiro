import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

// GET /api/v2/pessoal/categorias/[slug]?ano=Y
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const ano = Number(searchParams.get('ano') || new Date().getFullYear())
    const categoriaNome = decodeURIComponent(params.slug)

    // Busca categoria pelo nome
    const categoria = await prisma.categoriaPessoal.findFirst({
      where: { nome: categoriaNome, contaPessoalId: conta.id },
    })

    // Busca todas as transações dessa categoria (ou sem categoria se slug = 'sem-categoria')
    const transacoes = await prisma.transacaoPessoal.findMany({
      where: {
        contaPessoalId: conta.id,
        ano,
        ...(categoriaNome === 'Sem categoria'
          ? { categoriaId: null }
          : { categoriaId: categoria?.id || undefined }),
      },
      include: { categoria: true },
      orderBy: [{ mes: 'asc' }, { data: 'asc' }],
    })

    // Agrupa por mês
    const mesesMap = new Map<number, { mes: number; total: number; transacoes: any[] }>()
    for (const t of transacoes) {
      if (!mesesMap.has(t.mes)) mesesMap.set(t.mes, { mes: t.mes, total: 0, transacoes: [] })
      const m = mesesMap.get(t.mes)!
      m.total += Number(t.valor)
      m.transacoes.push({
        id: t.id,
        data: t.data,
        descricao: t.descricao,
        valor: Number(t.valor),
        tipo: t.tipo,
        origem: t.origem,
        cartao: t.cartao,
      })
    }

    const porMes = Array.from(mesesMap.values()).sort((a, b) => a.mes - b.mes)
    const totalAno = transacoes.reduce((s, t) => s + Number(t.valor), 0)
    const mediasMes = porMes.length > 0 ? totalAno / porMes.length : 0
    const tipo = transacoes[0]?.tipo || 'despesa'

    // Top 5 maiores transações do ano
    const top5 = [...transacoes]
      .sort((a, b) => Number(b.valor) - Number(a.valor))
      .slice(0, 5)
      .map((t) => ({
        data: t.data,
        descricao: t.descricao,
        valor: Number(t.valor),
        mes: t.mes,
      }))

    return Response.json({ categoriaNome, tipo, totalAno, mediasMes, porMes, top5, ano })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

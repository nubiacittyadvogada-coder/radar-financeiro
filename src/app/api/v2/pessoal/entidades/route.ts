import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ pessoal: [], lar: [], pj: [] })

    const { searchParams } = new URL(req.url)
    const mes = Number(searchParams.get('mes') || new Date().getMonth() + 1)
    const ano = Number(searchParams.get('ano') || new Date().getFullYear())

    const transacoes = await prisma.transacaoPessoal.findMany({
      where: { contaPessoalId: conta.id, mes, ano },
      include: { categoria: true },
      orderBy: { data: 'desc' },
    })

    const por = (ent: string) => transacoes.filter((t) => (t as any).entidade === ent || (ent === 'pessoal' && !(t as any).entidade))

    const resumo = (lista: typeof transacoes) => ({
      receitas: lista.filter((t) => t.tipo === 'receita').reduce((s, t) => s + Number(t.valor), 0),
      despesas: lista.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + Number(t.valor), 0),
      transacoes: lista,
    })

    return Response.json({
      pessoal: resumo(por('pessoal')),
      lar: resumo(por('lar')),
      pj: resumo(por('pj')),
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

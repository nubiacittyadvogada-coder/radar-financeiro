import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json([])

    const { searchParams } = new URL(req.url)
    const mes = Number(searchParams.get('mes') || new Date().getMonth() + 1)
    const ano = Number(searchParams.get('ano') || new Date().getFullYear())

    const orcamentos = await prisma.orcamentoPessoal.findMany({
      where: { contaPessoalId: conta.id, mes, ano },
      include: { categoria: true },
    })

    // Calcula gasto real de transações do mês por categoria
    const transacoes = await prisma.transacaoPessoal.findMany({
      where: { contaPessoalId: conta.id, mes, ano, tipo: 'despesa' },
      select: { categoriaId: true, valor: true },
    })

    const gastoReal = new Map<string, number>()
    for (const t of transacoes) {
      if (!t.categoriaId) continue
      gastoReal.set(t.categoriaId, (gastoReal.get(t.categoriaId) || 0) + Number(t.valor))
    }

    const resultado = orcamentos.map((o) => ({
      ...o,
      valorGastoReal: gastoReal.get(o.categoriaId) || 0,
    }))

    return Response.json(resultado)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta pessoal não encontrada' }, { status: 404 })

    const { categoriaId, mes, ano, valorMeta } = await req.json()

    const orc = await prisma.orcamentoPessoal.upsert({
      where: { contaPessoalId_categoriaId_mes_ano: { contaPessoalId: conta.id, categoriaId, mes, ano } },
      update: { valorMeta },
      create: { contaPessoalId: conta.id, categoriaId, mes, ano, valorMeta },
      include: { categoria: true },
    })

    return Response.json(orc, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return Response.json({ erro: 'id obrigatório' }, { status: 400 })
    await prisma.orcamentoPessoal.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

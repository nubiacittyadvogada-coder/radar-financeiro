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
      orderBy: { categoria: { nome: 'asc' } },
    })

    // Gasto real por categoria E por titular
    const transacoes = await prisma.transacaoPessoal.findMany({
      where: { contaPessoalId: conta.id, mes, ano, tipo: 'despesa' },
      select: { categoriaId: true, valor: true, titular: true },
    })

    const gastoTotal = new Map<string, number>()
    const gastoNubia = new Map<string, number>()
    const gastoMatheus = new Map<string, number>()

    for (const t of transacoes) {
      if (!t.categoriaId) continue
      gastoTotal.set(t.categoriaId, (gastoTotal.get(t.categoriaId) || 0) + Number(t.valor))
      if (t.titular === 'nubia' || !t.titular) {
        gastoNubia.set(t.categoriaId, (gastoNubia.get(t.categoriaId) || 0) + Number(t.valor))
      }
      if (t.titular === 'matheus') {
        gastoMatheus.set(t.categoriaId, (gastoMatheus.get(t.categoriaId) || 0) + Number(t.valor))
      }
    }

    const resultado = orcamentos.map((o) => ({
      ...o,
      valorGastoReal: gastoTotal.get(o.categoriaId) || 0,
      gastoNubia: gastoNubia.get(o.categoriaId) || 0,
      gastoMatheus: gastoMatheus.get(o.categoriaId) || 0,
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

    const { categoriaId, mes, ano, valorMeta, titular } = await req.json()

    const orc = await prisma.orcamentoPessoal.upsert({
      where: { contaPessoalId_categoriaId_mes_ano: { contaPessoalId: conta.id, categoriaId, mes, ano } },
      update: { valorMeta, titular: titular || null },
      create: { contaPessoalId: conta.id, categoriaId, mes, ano, valorMeta, titular: titular || null },
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

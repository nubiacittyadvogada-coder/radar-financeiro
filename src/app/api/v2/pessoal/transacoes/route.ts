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
    const mes = searchParams.get('mes') ? Number(searchParams.get('mes')) : undefined
    const ano = searchParams.get('ano') ? Number(searchParams.get('ano')) : undefined
    const tipo = searchParams.get('tipo') || undefined

    const transacoes = await prisma.transacaoPessoal.findMany({
      where: {
        contaPessoalId: conta.id,
        ...(mes ? { mes } : {}),
        ...(ano ? { ano } : {}),
        ...(tipo ? { tipo } : {}),
      },
      include: { categoria: true, projeto: true },
      orderBy: { data: 'desc' },
    })
    return Response.json(transacoes)
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

    const body = await req.json()
    const data = new Date(body.data)

    const t = await prisma.transacaoPessoal.create({
      data: {
        contaPessoalId: conta.id,
        tipo: body.tipo,
        descricao: body.descricao,
        valor: body.valor,
        data,
        mes: data.getMonth() + 1,
        ano: data.getFullYear(),
        categoriaId: body.categoriaId || null,
        projetoId: body.projetoId || null,
        cartao: body.cartao || null,
        recorrente: body.recorrente || false,
        observacoes: body.observacoes || null,
        origem: body.origem || 'manual',
      },
      include: { categoria: true },
    })

    // Atualiza orçamento se existir
    if (body.categoriaId && body.tipo === 'despesa') {
      await prisma.orcamentoPessoal.updateMany({
        where: {
          contaPessoalId: conta.id,
          categoriaId: body.categoriaId,
          mes: data.getMonth() + 1,
          ano: data.getFullYear(),
        },
        data: { valorGasto: { increment: Math.abs(Number(body.valor)) } },
      })
    }

    return Response.json(t, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

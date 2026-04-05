import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u?.isAdmin) return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const cupons = await prisma.cupomDesconto.findMany({
      include: { _count: { select: { usos: true } } },
      orderBy: { criadoEm: 'desc' },
    })
    return Response.json(cupons)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u?.isAdmin) return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const body = await req.json()
    const cupom = await prisma.cupomDesconto.create({
      data: {
        codigo: body.codigo.toUpperCase().trim(),
        descricao: body.descricao || null,
        tipo: body.tipo,
        valor: body.valor || 0,
        diasTrial: body.diasTrial || null,
        planoAlvo: body.planoAlvo,
        usoMax: body.usoMax || null,
        validoAte: body.validoAte ? new Date(body.validoAte) : null,
      },
    })
    return Response.json(cupom, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

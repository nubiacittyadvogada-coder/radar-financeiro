import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

async function getTransacao(u: { id: string }, id: string) {
  const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
  if (!conta) return null
  return prisma.transacaoPessoal.findFirst({ where: { id, contaPessoalId: conta.id } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const transacao = await getTransacao(u, params.id)
    if (!transacao) return Response.json({ erro: 'Transação não encontrada' }, { status: 404 })
    const body = await req.json()
    const updated = await prisma.transacaoPessoal.update({
      where: { id: params.id },
      data: { categoriaId: body.categoriaId ?? null },
      include: { categoria: true },
    })
    return Response.json(updated)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const transacao = await getTransacao(u, params.id)
    if (!transacao) return Response.json({ erro: 'Transação não encontrada' }, { status: 404 })
    await prisma.transacaoPessoal.delete({ where: { id: params.id } })
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

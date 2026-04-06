import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export const maxDuration = 60

async function getMeta(u: { id: string }, id: string) {
  const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
  if (!conta) return null
  return prisma.metaPessoal.findFirst({ where: { id, contaPessoalId: conta.id } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const meta = await getMeta(u, params.id)
    if (!meta) return Response.json({ erro: 'Meta não encontrada' }, { status: 404 })
    const body = await req.json()
    const atualizada = await prisma.metaPessoal.update({ where: { id: params.id }, data: body })
    return Response.json(atualizada)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const meta = await getMeta(u, params.id)
    if (!meta) return Response.json({ erro: 'Meta não encontrada' }, { status: 404 })
    await prisma.metaPessoal.delete({ where: { id: params.id } })
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

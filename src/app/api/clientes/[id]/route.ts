import { NextRequest } from 'next/server'
import { getUsuario, isBpo } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { hashSenha } from '@/server/lib/auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const u = getUsuario(req)
  if (!u || !isBpo(u)) return Response.json({ erro: 'Acesso restrito ao BPO' }, { status: 403 })

  const cliente = await prisma.cliente.findFirst({
    where: { id: params.id, bpoId: u.bpoId! },
    include: { _count: { select: { importacoes: true, fechamentos: true, alertas: true } } },
  })

  if (!cliente) return Response.json({ erro: 'Cliente não encontrado' }, { status: 404 })
  return Response.json(cliente)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || !isBpo(u)) return Response.json({ erro: 'Acesso restrito ao BPO' }, { status: 403 })

    const data = await req.json()
    if (data.senha) {
      data.senhaHash = await hashSenha(data.senha)
      delete data.senha
    }

    const cliente = await prisma.cliente.update({ where: { id: params.id }, data })
    return Response.json(cliente)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const u = getUsuario(req)
  if (!u || !isBpo(u)) return Response.json({ erro: 'Acesso restrito ao BPO' }, { status: 403 })

  await prisma.cliente.update({ where: { id: params.id }, data: { ativo: false } })
  return Response.json({ ok: true })
}

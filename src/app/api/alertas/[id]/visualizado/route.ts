import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const u = getUsuario(req)
  if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

  const alerta = await prisma.alerta.findUnique({ where: { id: params.id } })
  if (!alerta) return Response.json({ erro: 'Alerta não encontrado' }, { status: 404 })
  if (u.tipo === 'cliente' && alerta.clienteId !== u.id) return Response.json({ erro: 'Acesso negado' }, { status: 403 })

  await prisma.alerta.update({ where: { id: params.id }, data: { enviado: true, enviadoEm: new Date() } })
  return Response.json({ ok: true })
}

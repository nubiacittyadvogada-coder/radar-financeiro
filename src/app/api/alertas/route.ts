import { NextRequest } from 'next/server'
import { getUsuario, isBpo } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  const u = getUsuario(req)
  if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

  let clienteId: string
  if (u.tipo === 'cliente') {
    clienteId = u.id
  } else {
    clienteId = new URL(req.url).searchParams.get('clienteId') || ''
    if (!clienteId) return Response.json({ erro: 'clienteId obrigatório para BPO' }, { status: 400 })
  }

  const alertas = await prisma.alerta.findMany({
    where: { clienteId },
    orderBy: { criadoEm: 'desc' },
    take: 20,
  })

  return Response.json(alertas)
}

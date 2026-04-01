import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaPagar.findUnique({ where: { id: params.id } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    if (u.tipo === 'cliente' && conta.clienteId !== u.id) {
      return Response.json({ erro: 'Sem permissão' }, { status: 403 })
    }

    await prisma.contaPagar.delete({ where: { id: params.id } })
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

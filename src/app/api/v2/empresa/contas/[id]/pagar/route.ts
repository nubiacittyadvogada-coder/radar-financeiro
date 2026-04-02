import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaPagarEmpresa.update({
      where: { id: params.id },
      data: { status: 'pago', pagoEm: new Date() },
    })
    return Response.json(conta)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

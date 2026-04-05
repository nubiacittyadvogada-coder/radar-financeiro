import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || !u.isAdmin) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const assinaturas = await prisma.assinaturaRadar.findMany({
      include: {
        usuario: { select: { nome: true, email: true, plano: true, planoValidoAte: true } },
        pagamentos: { orderBy: { criadoEm: 'desc' }, take: 3 },
      },
      orderBy: { criadoEm: 'desc' },
    })

    const receita = assinaturas
      .filter(a => a.status === 'ativa')
      .reduce((s, a) => s + Number(a.valorMensal), 0)

    return Response.json({ assinaturas, mrr: receita })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ atrasadas: [], proximas: [] })

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const em7dias = new Date(hoje)
    em7dias.setDate(em7dias.getDate() + 7)

    const [atrasadas, proximas] = await Promise.all([
      prisma.contaPagarEmpresa.findMany({
        where: { contaEmpresaId: conta.id, status: 'pendente', vencimento: { lt: hoje } },
        orderBy: { vencimento: 'asc' },
      }),
      prisma.contaPagarEmpresa.findMany({
        where: { contaEmpresaId: conta.id, status: 'pendente', vencimento: { gte: hoje, lte: em7dias } },
        orderBy: { vencimento: 'asc' },
      }),
    ])

    return Response.json({ atrasadas, proximas })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

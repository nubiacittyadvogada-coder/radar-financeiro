import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const clienteId = u.tipo === 'cliente' ? u.id : new URL(req.url).searchParams.get('clienteId') || ''
    if (!clienteId) return Response.json({ erro: 'clienteId obrigatório' }, { status: 400 })

    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const em7dias = new Date(hoje); em7dias.setDate(em7dias.getDate() + 7); em7dias.setHours(23, 59, 59, 999)

    const [atrasadas, proximas] = await Promise.all([
      prisma.contaPagar.findMany({ where: { clienteId, status: 'atrasado' }, orderBy: { vencimento: 'asc' } }),
      prisma.contaPagar.findMany({ where: { clienteId, status: 'pendente', vencimento: { gte: hoje, lte: em7dias } }, orderBy: { vencimento: 'asc' } }),
    ])

    return Response.json({ atrasadas, proximas })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

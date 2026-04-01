import { NextRequest } from 'next/server'
import { getUsuario, isBpo } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest, { params }: { params: { clienteId: string } }) {
  const u = getUsuario(req)
  if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

  const { clienteId } = params
  if (u.tipo === 'cliente' && u.id !== clienteId) return Response.json({ erro: 'Acesso negado' }, { status: 403 })
  if (isBpo(u)) {
    const c = await prisma.cliente.findFirst({ where: { id: clienteId, bpoId: u.bpoId! } })
    if (!c) return Response.json({ erro: 'Acesso negado' }, { status: 403 })
  }

  const ultimos = parseInt(new URL(req.url).searchParams.get('ultimos') || '6')
  const fechamentos = await prisma.fechamento.findMany({
    where: { clienteId },
    orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
    take: ultimos,
    select: {
      id: true, mes: true, ano: true, receitaBruta: true, receitaLiquida: true,
      lucroOperacional: true, percLucroOp: true, lucroLiquido: true, percLucroLiq: true,
      saldoFinal: true, resultadoCaixa: true, retiradaSocios: true,
      totalDespesasAdm: true, margemContribuicao: true, percMargem: true, pdfUrl: true,
    },
  })

  return Response.json(fechamentos)
}

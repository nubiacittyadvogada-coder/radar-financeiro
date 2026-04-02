import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

// GET /api/v2/empresa/historico?ultimos=6
export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const ultimos = Number(searchParams.get('ultimos') || 6)

    const fechamentos = await prisma.fechamentoEmpresa.findMany({
      where: { contaEmpresaId: conta.id },
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
      take: ultimos,
    })

    return Response.json(fechamentos.reverse())
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  const u = getUsuario(req)
  if (!u?.isAdmin) return Response.json({ erro: 'Acesso restrito' }, { status: 403 })

  try {
    const agora = new Date()
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    const inicioSemana = new Date(agora)
    inicioSemana.setDate(agora.getDate() - 7)

    const [
      totalUsuarios,
      usuariosAtivos,
      novosEstaMes,
      novosSemana,
      totalEmpresa,
      totalPessoal,
      planos,
    ] = await Promise.all([
      prisma.usuario.count(),
      prisma.usuario.count({ where: { ativo: true } }),
      prisma.usuario.count({ where: { criadoEm: { gte: inicioMes } } }),
      prisma.usuario.count({ where: { criadoEm: { gte: inicioSemana } } }),
      prisma.contaEmpresa.count(),
      prisma.contaPessoal.count(),
      prisma.usuario.groupBy({ by: ['plano'], _count: true }),
    ])

    return Response.json({
      totalUsuarios,
      usuariosAtivos,
      usuariosSuspensos: totalUsuarios - usuariosAtivos,
      novosEstaMes,
      novosSemana,
      totalEmpresa,
      totalPessoal,
      planos: planos.map((p) => ({ plano: p.plano, count: p._count })),
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

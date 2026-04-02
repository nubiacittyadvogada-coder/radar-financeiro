import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

function isAdmin(req: NextRequest) {
  const u = getUsuario(req)
  return u?.isAdmin === true
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ erro: 'Acesso restrito' }, { status: 403 })

  try {
    const { searchParams } = new URL(req.url)
    const busca = searchParams.get('q') || ''
    const pagina = Number(searchParams.get('pagina') || 1)
    const por = 20
    const skip = (pagina - 1) * por

    const where = busca
      ? { OR: [{ nome: { contains: busca, mode: 'insensitive' as const } }, { email: { contains: busca, mode: 'insensitive' as const } }] }
      : {}

    const [usuarios, total] = await Promise.all([
      prisma.usuario.findMany({
        where,
        include: {
          contaEmpresa: { select: { nomeEmpresa: true, asaasAtivo: true, alertaAtivo: true } },
          contaPessoal: { select: { id: true, _count: { select: { transacoes: true, metas: true } } } },
        },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: por,
      }),
      prisma.usuario.count({ where }),
    ])

    return Response.json({ usuarios, total, paginas: Math.ceil(total / por), pagina })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

// PATCH — suspender/ativar/alterar plano
export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ erro: 'Acesso restrito' }, { status: 403 })

  try {
    const { id, ativo, plano } = await req.json()
    if (!id) return Response.json({ erro: 'id obrigatório' }, { status: 400 })

    const update: any = {}
    if (ativo !== undefined) update.ativo = ativo
    if (plano) update.plano = plano

    const u = await prisma.usuario.update({ where: { id }, data: update })
    return Response.json({ ok: true, ativo: u.ativo, plano: u.plano })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

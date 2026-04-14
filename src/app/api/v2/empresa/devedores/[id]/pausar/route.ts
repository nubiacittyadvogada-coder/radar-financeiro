import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

// POST /api/v2/empresa/devedores/:id/pausar
// Body: { dias: number } — pausa cobrança por X dias (0 = retomar)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const devedor = await prisma.clienteDevedor.findFirst({
      where: { id: params.id, contaEmpresaId: conta.id },
    })
    if (!devedor) return Response.json({ erro: 'Devedor não encontrado' }, { status: 404 })

    const { dias } = await req.json()

    const pausadaAte = dias > 0
      ? new Date(Date.now() + dias * 24 * 60 * 60 * 1000)
      : null

    await prisma.clienteDevedor.update({
      where: { id: params.id },
      data: { cobrancaPausadaAte: pausadaAte },
    })

    return Response.json({ ok: true, pausadaAte })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

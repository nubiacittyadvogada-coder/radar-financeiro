import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const usuario = await prisma.usuario.findUnique({
      where: { id: u.id },
      select: { plano: true, planoValidoAte: true, assinatura: true },
    })

    if (!usuario) return Response.json({ erro: 'Usuário não encontrado' }, { status: 404 })

    // Verifica se plano pago expirou
    const planoAtivo = usuario.planoValidoAte && new Date(usuario.planoValidoAte) < new Date()
      ? 'basico'
      : usuario.plano

    return Response.json({
      plano: planoAtivo,
      planoValidoAte: usuario.planoValidoAte,
      assinatura: usuario.assinatura,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

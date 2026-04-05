import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const codigo = searchParams.get('codigo')?.toUpperCase().trim()
    if (!codigo) return Response.json({ erro: 'Código obrigatório' }, { status: 400 })

    const cupom = await prisma.cupomDesconto.findUnique({ where: { codigo } })
    if (!cupom || !cupom.ativo) return Response.json({ erro: 'Cupom inválido ou expirado' }, { status: 404 })
    if (cupom.validoAte && new Date(cupom.validoAte) < new Date()) return Response.json({ erro: 'Cupom expirado' }, { status: 400 })
    if (cupom.usoMax && cupom.usoAtual >= cupom.usoMax) return Response.json({ erro: 'Cupom esgotado' }, { status: 400 })

    // Verifica se usuário já usou
    const jaUsou = await prisma.usoCupom.findUnique({
      where: { cupomId_usuarioId: { cupomId: cupom.id, usuarioId: u.id } },
    })
    if (jaUsou) return Response.json({ erro: 'Você já utilizou este cupom' }, { status: 400 })

    return Response.json({
      valido: true,
      tipo: cupom.tipo,
      valor: Number(cupom.valor),
      diasTrial: cupom.diasTrial,
      planoAlvo: cupom.planoAlvo,
      descricao: cupom.descricao,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

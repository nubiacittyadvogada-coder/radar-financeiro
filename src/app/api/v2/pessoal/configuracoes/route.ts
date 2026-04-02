import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta pessoal não encontrada' }, { status: 404 })
    return Response.json(conta)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta pessoal não encontrada' }, { status: 404 })

    const body = await req.json()
    const update: any = {}

    if ('metaEconomiasMensal' in body) {
      update.metaEconomiasMensal = body.metaEconomiasMensal ? Number(body.metaEconomiasMensal) : null
    }
    if ('diaFechamento' in body) {
      const dia = Number(body.diaFechamento)
      if (dia >= 1 && dia <= 28) update.diaFechamento = dia
    }

    const atualizada = await prisma.contaPessoal.update({
      where: { id: conta.id },
      data: update,
    })

    return Response.json({ ok: true, metaEconomiasMensal: atualizada.metaEconomiasMensal, diaFechamento: atualizada.diaFechamento })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

import { NextRequest } from 'next/server'
import { getUsuario, isBpo } from '@/lib/auth-utils'
import { gerarEstrategia } from '@/server/lib/iaFinanceira'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const body = await req.json()
    const clienteId = u.tipo === 'cliente' ? u.id : body.clienteId
    if (!clienteId) return Response.json({ erro: 'clienteId obrigatório' }, { status: 400 })

    const estrategia = await gerarEstrategia(clienteId)
    return Response.json(estrategia)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

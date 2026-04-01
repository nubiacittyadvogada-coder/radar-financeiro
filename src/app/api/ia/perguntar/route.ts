import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import { responderPergunta } from '@/server/lib/iaFinanceira'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const body = await req.json()
    const { pergunta, mes, ano } = body
    if (!pergunta) return Response.json({ erro: 'Pergunta é obrigatória' }, { status: 400 })

    const clienteId = u.tipo === 'cliente' ? u.id : body.clienteId
    if (!clienteId) return Response.json({ erro: 'clienteId obrigatório' }, { status: 400 })

    const resposta = await responderPergunta(clienteId, pergunta, mes, ano)
    return Response.json({ resposta, mes, ano })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

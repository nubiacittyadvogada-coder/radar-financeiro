import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import { parsearOFX, parsearCSV } from '@/server/lib/parsearExtrato'
import { categorizarTransacoes } from '@/server/lib/categorizarExtrato'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('arquivo') as File | null
    const banco = formData.get('banco') as string

    if (!file) return Response.json({ erro: 'Arquivo não enviado' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const texto = buffer.toString('utf-8')

    let transacoes: any[]
    if (banco === 'ofx' || file.name.endsWith('.ofx')) {
      transacoes = parsearOFX(texto)
    } else {
      transacoes = parsearCSV(texto, banco)
    }

    if (transacoes.length === 0) {
      return Response.json({ erro: 'Nenhuma transação encontrada no arquivo' }, { status: 400 })
    }

    const categorizadas = await categorizarTransacoes(transacoes, 'Empresa', 'geral')
    return Response.json({ transacoes: categorizadas, total: categorizadas.length })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

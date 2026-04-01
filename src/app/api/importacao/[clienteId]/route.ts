import { NextRequest } from 'next/server'
import { getUsuario, isBpo } from '@/lib/auth-utils'
import { processarImportacao } from '@/server/lib/processarExcel'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { clienteId: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || !isBpo(u)) return Response.json({ erro: 'Acesso restrito ao BPO' }, { status: 403 })

    const formData = await req.formData()
    const file = formData.get('arquivo') as File | null
    if (!file) return Response.json({ erro: 'Arquivo não enviado' }, { status: 400 })

    const mes = parseInt(formData.get('mes') as string)
    const ano = parseInt(formData.get('ano') as string)
    if (!mes || !ano) return Response.json({ erro: 'mes e ano são obrigatórios' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const resultado = await processarImportacao(params.clienteId, buffer, mes, ano)

    return Response.json(resultado, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

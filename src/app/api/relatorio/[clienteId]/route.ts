import { NextRequest } from 'next/server'
import { getUsuario, isBpo } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { gerarRelatorioPdf } from '@/server/lib/gerarRelatorio'

export async function GET(req: NextRequest, { params }: { params: { clienteId: string } }) {
  try {
    const u = getUsuario(req)
    if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const { clienteId } = params
    if (u.tipo === 'cliente' && u.id !== clienteId) return Response.json({ erro: 'Acesso negado' }, { status: 403 })

    const sp = new URL(req.url).searchParams
    const mes = parseInt(sp.get('mes') || '')
    const ano = parseInt(sp.get('ano') || '')
    if (!mes || !ano) return Response.json({ erro: 'mes e ano obrigatórios' }, { status: 400 })

    const pdfBuffer = await gerarRelatorioPdf(clienteId, mes, ano)
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="relatorio-${mes}-${ano}.pdf"`,
      },
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

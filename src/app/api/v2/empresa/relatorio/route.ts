import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { gerarRelatorioEmpresaPdf } from '@/server/lib/gerarRelatorioEmpresa'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const mes = Number(searchParams.get('mes') || new Date().getMonth() + 1)
    const ano = Number(searchParams.get('ano') || new Date().getFullYear())

    const pdfBuffer = await gerarRelatorioEmpresaPdf(conta.id, mes, ano)

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="relatorio-${mes}-${ano}.pdf"`,
      },
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

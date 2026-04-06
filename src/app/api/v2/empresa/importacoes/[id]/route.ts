import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { calcularFechamentoEmpresa } from '@/server/lib/calcularFechamentoEmpresa'

export const maxDuration = 60

// DELETE /api/v2/empresa/importacoes/[id]
// Remove a importação e todos os seus lançamentos, recalcula fechamentos afetados
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const importacao = await prisma.importacaoEmpresa.findUnique({
      where: { id: params.id },
      include: { lancamentos: { select: { mes: true, ano: true } } },
    })

    if (!importacao) return Response.json({ erro: 'Importação não encontrada' }, { status: 404 })
    if (importacao.contaEmpresaId !== conta.id) return Response.json({ erro: 'Não autorizado' }, { status: 403 })

    // Descobre quais meses/anos serão afetados
    const mesesAfetados = new Set<string>()
    importacao.lancamentos.forEach((l) => mesesAfetados.add(`${l.mes}-${l.ano}`))

    // Deleta lançamentos e importação
    await prisma.lancamentoEmpresa.deleteMany({ where: { importacaoId: params.id } })
    await prisma.importacaoEmpresa.delete({ where: { id: params.id } })

    // Recalcula fechamentos afetados
    for (const chave of mesesAfetados) {
      const [mes, ano] = chave.split('-').map(Number)
      await calcularFechamentoEmpresa(conta.id, mes, ano)
    }

    return Response.json({
      ok: true,
      lancamentosRemovidos: importacao.lancamentos.length,
      mesesRecalculados: mesesAfetados.size,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

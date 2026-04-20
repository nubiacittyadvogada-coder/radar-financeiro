/**
 * DELETE /api/v2/empresa/lancamentos/reset-ofx?mes=4&ano=2026
 * Remove todos os lançamentos origin = 'ofx_sicredi' do mês/ano informado,
 * permitindo re-importação com as regras atualizadas.
 * Também reseta conciliado=false nos lançamentos asaas_webhook do mesmo período.
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { calcularFechamentoEmpresa } from '@/server/lib/calcularFechamentoEmpresa'

export async function DELETE(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const mes = Number(searchParams.get('mes'))
    const ano = Number(searchParams.get('ano'))

    if (!mes || !ano || mes < 1 || mes > 12 || ano < 2020) {
      return Response.json({ erro: 'Parâmetros mes e ano obrigatórios e válidos' }, { status: 400 })
    }

    // Remove lançamentos OFX Sicredi do período
    const deletados = await prisma.lancamentoEmpresa.deleteMany({
      where: {
        contaEmpresaId: conta.id,
        origem: 'ofx_sicredi',
        mes,
        ano,
      },
    })

    // Reseta conciliado nos asaas_webhook do mesmo período (permitem nova conciliação)
    const resetados = await prisma.lancamentoEmpresa.updateMany({
      where: {
        contaEmpresaId: conta.id,
        origem: 'asaas_webhook',
        conciliado: true,
        mes,
        ano,
      },
      data: { conciliado: false },
    })

    // Remove importações OFX Sicredi do período
    await prisma.importacaoEmpresa.deleteMany({
      where: {
        contaEmpresaId: conta.id,
        tipo: 'ofx_sicredi',
        mes,
        ano,
      },
    })

    // Recalcula fechamento
    await calcularFechamentoEmpresa(conta.id, mes, ano)

    return Response.json({
      ok: true,
      deletados: deletados.count,
      asaasResetados: resetados.count,
      mensagem: `${deletados.count} lançamentos OFX Sicredi removidos. ${resetados.count} lançamentos Asaas marcados para nova conciliação.`,
    })
  } catch (err: any) {
    console.error('[reset-ofx]', err.message)
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

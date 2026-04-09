import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { classificar } from '@/server/lib/classificador'
import { calcularFechamentoEmpresa } from '@/server/lib/calcularFechamentoEmpresa'

export const maxDuration = 60

// POST /api/v2/empresa/importar
// Recebe lancamentos[] já parseados pelo frontend (xlsx), classifica e salva
export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const body = await req.json()
    const { lancamentos, mes, ano, tipo, nomeArquivo } = body

    if (!Array.isArray(lancamentos) || lancamentos.length === 0) {
      return Response.json({ erro: 'lancamentos[] obrigatório' }, { status: 400 })
    }

    // Cria registro de importação
    const importacao = await prisma.importacaoEmpresa.create({
      data: {
        contaEmpresaId: conta.id,
        tipo: tipo || 'dre',
        nomeArquivo: nomeArquivo || 'planilha.xlsx',
        mes: Number(mes),
        ano: Number(ano),
        status: 'processando',
        totalLinhas: lancamentos.length,
      },
    })

    // Classifica e insere lançamentos
    const dados = lancamentos.map((l: any) => {
      // Se o frontend já enviou tipo/grupoConta (ex: importação PDF), usa direto.
      // Só chama o classificador para planilhas Excel que usam código P.CONTAS.
      let tipoFinal = l.tipo as string | undefined
      let subtipoFinal = l.subtipo as string | null | undefined
      let grupoContaFinal = l.grupoConta as string | undefined

      if (!tipoFinal) {
        let classificacao = { tipo: 'geral', subtipo: null as string | null, grupoConta: '' }
        try {
          const r = classificar(l.planoConta)
          classificacao = { tipo: r.tipo, subtipo: r.subtipo ?? null, grupoConta: r.grupoConta }
        } catch {}
        tipoFinal = classificacao.tipo
        subtipoFinal = classificacao.subtipo
        grupoContaFinal = classificacao.grupoConta
      }

      const dataComp = l.data ? new Date(l.data) : (l.dataCompetencia ? new Date(l.dataCompetencia) : null)

      return {
        contaEmpresaId: conta.id,
        importacaoId: importacao.id,
        origem: 'importacao' as const,
        mes: Number(mes),
        ano: Number(ano),
        favorecido: l.favorecido ? String(l.favorecido).trim() : null,
        planoConta: String(l.planoConta || '').trim(),
        grupoConta: grupoContaFinal || '',
        area: l.area ? String(l.area).trim() : null,
        advogado: l.advogado ? String(l.advogado).trim() : null,
        descricao: l.descricao ? String(l.descricao).trim() : null,
        dataCompetencia: dataComp,
        valor: Number(l.valor),
        dataVencimento: l.dataVencimento ? new Date(l.dataVencimento) : null,
        statusPg: l.statusPg ? String(l.statusPg).trim() : (l.pago ? 'OK PG' : null),
        dataPagamento: l.dataPagamento ? new Date(l.dataPagamento) : null,
        formaPagamento: l.formaPagamento ? String(l.formaPagamento).trim() : null,
        banco: l.banco ? String(l.banco).trim() : null,
        observacoes: l.observacoes ? String(l.observacoes).trim() : null,
        tipo: tipoFinal,
        subtipo: subtipoFinal ?? null,
        previsto: !!l.previsto,
      }
    })

    // ── Deduplicação: evita inserir lançamentos já existentes ──────────────────
    const jaExistentes = await prisma.lancamentoEmpresa.findMany({
      where: { contaEmpresaId: conta.id, mes: Number(mes), ano: Number(ano) },
      select: { dataCompetencia: true, valor: true, descricao: true },
    })
    const chaveExistente = new Set(
      jaExistentes.map(e =>
        `${e.dataCompetencia?.toISOString().slice(0, 10)}|${Number(e.valor).toFixed(2)}|${(e.descricao || '').toLowerCase().trim()}`
      )
    )
    const dadosFiltrados = dados.filter(d => {
      const chave = `${d.dataCompetencia?.toISOString().slice(0, 10)}|${Number(d.valor).toFixed(2)}|${(d.descricao || '').toLowerCase().trim()}`
      return !chaveExistente.has(chave)
    })

    // ── Conciliação com Contas a Pagar ─────────────────────────────────────────
    // Para cada despesa do extrato PDF, verifica se existe uma conta a pagar
    // com valor próximo (±5%) e vencimento próximo (±7 dias).
    // Se sim, marca a conta como paga em vez de criar lançamento duplicado.
    let conciliados = 0
    const isPdfImport = tipo === 'extrato_pdf'

    if (isPdfImport) {
      // Busca contas a pagar pendentes/atrasadas do mesmo período (±1 mês)
      const inicioJanela = new Date(Number(ano), Number(mes) - 2, 1)
      const fimJanela = new Date(Number(ano), Number(mes) + 1, 0)
      const contasAbertas = await prisma.contaPagarEmpresa.findMany({
        where: {
          contaEmpresaId: conta.id,
          status: { in: ['pendente', 'atrasado'] },
          vencimento: { gte: inicioJanela, lte: fimJanela },
        },
      })

      const contasPagasIds: string[] = []

      // Para cada despesa filtrada, tenta reconciliar com conta a pagar
      const dadosParaInserir: typeof dadosFiltrados = []
      for (const d of dadosFiltrados) {
        if (d.tipo === 'receita') {
          dadosParaInserir.push(d)
          continue
        }
        const valorD = Number(d.valor)
        const dataD = d.dataCompetencia

        // Procura conta a pagar que bate (valor ±5%, data ±7 dias)
        const match = contasAbertas.find(c => {
          const valorC = Number(c.valor)
          const diffValor = Math.abs(valorC - valorD) / valorC
          if (diffValor > 0.05) return false
          if (!dataD) return false
          const diffDias = Math.abs(new Date(c.vencimento).getTime() - dataD.getTime()) / 86400000
          return diffDias <= 7
        })

        if (match && !contasPagasIds.includes(match.id)) {
          // Reconcilia: marca conta a pagar como paga, não cria lançamento duplicado
          contasPagasIds.push(match.id)
          conciliados++
        } else {
          // Sem correspondência: cria lançamento normalmente
          dadosParaInserir.push(d)
        }
      }

      // Atualiza contas a pagar reconciliadas
      if (contasPagasIds.length > 0) {
        await prisma.contaPagarEmpresa.updateMany({
          where: { id: { in: contasPagasIds } },
          data: { status: 'pago', pagoEm: new Date() },
        })
      }

      if (dadosParaInserir.length > 0) {
        await prisma.lancamentoEmpresa.createMany({ data: dadosParaInserir })
      }
      await prisma.importacaoEmpresa.update({
        where: { id: importacao.id },
        data: { status: 'concluido', linhasProcessadas: dadosParaInserir.length + conciliados },
      })

      const fechamento = await calcularFechamentoEmpresa(conta.id, Number(mes), Number(ano))
      return Response.json({
        ok: true,
        total: dadosParaInserir.length,
        inseridos: dadosParaInserir.length,
        duplicatas: dados.length - dadosFiltrados.length,
        conciliados,
        fechamento,
      }, { status: 201 })
    }

    if (dadosFiltrados.length > 0) {
      await prisma.lancamentoEmpresa.createMany({ data: dadosFiltrados })
    }
    await prisma.importacaoEmpresa.update({
      where: { id: importacao.id },
      data: { status: 'concluido', linhasProcessadas: dados.length },
    })

    // Recalcula fechamento
    const fechamento = await calcularFechamentoEmpresa(conta.id, Number(mes), Number(ano))

    return Response.json({ ok: true, total: dadosFiltrados.length, inseridos: dadosFiltrados.length, duplicatas: dados.length - dadosFiltrados.length, fechamento }, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

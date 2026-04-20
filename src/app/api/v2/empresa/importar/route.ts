import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { classificar } from '@/server/lib/classificador'
import { calcularFechamentoEmpresa } from '@/server/lib/calcularFechamentoEmpresa'

export const maxDuration = 60

// POST /api/v2/empresa/importar
// Recebe lancamentos[] já parseados pelo frontend (xlsx, pdf, ofx), classifica e salva
export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const body = await req.json()
    const { lancamentos, mes, ano, tipo, nomeArquivo, transferenciasAsaas } = body

    // PDF, OFX Sicredi e OFX Asaas têm dados reais de transação — ativam conciliação automática
    const isTransactionImport = tipo === 'extrato_pdf' || tipo === 'ofx_sicredi'
    const isPdfImport = isTransactionImport

    // Mapeia tipo de importação para origem do lançamento
    const origemMap: Record<string, string> = {
      extrato_pdf:  'importacao',
      ofx_sicredi:  'ofx_sicredi',
      asaas_ofx:    'asaas_ofx',
      receitas:     'importacao',
      despesas:     'importacao',
    }
    const origemLancamento = origemMap[tipo] || 'importacao'

    if (!Array.isArray(lancamentos) || lancamentos.length === 0) {
      return Response.json({ erro: 'lancamentos[] obrigatório' }, { status: 400 })
    }

    // ── Asaas OFX: fluxo separado (dedup por FITID, sem proximidade) ──────────
    if (tipo === 'asaas_ofx') {
      const importacao = await prisma.importacaoEmpresa.create({
        data: {
          contaEmpresaId: conta.id,
          tipo: 'asaas_ofx',
          nomeArquivo: nomeArquivo || 'extrato_asaas.ofx',
          mes: Number(mes),
          ano: Number(ano),
          status: 'processando',
          totalLinhas: lancamentos.length,
        },
      })

      // Dedup por FITID (observacoes = "asaas_ofx:FITID")
      const fitidsExistentes = new Set(
        (await prisma.lancamentoEmpresa.findMany({
          where: { contaEmpresaId: conta.id, observacoes: { startsWith: 'asaas_ofx:' } },
          select: { observacoes: true },
        })).map(l => l.observacoes || '')
      )

      const dados = lancamentos
        .filter((l: any) => !fitidsExistentes.has(`asaas_ofx:${l.fitid || ''}`))
        .map((l: any) => {
          const dataComp = l.data ? new Date(l.data) : null
          const mesL = dataComp ? dataComp.getUTCMonth() + 1 : Number(mes)
          const anoL = dataComp ? dataComp.getUTCFullYear() : Number(ano)
          return {
            contaEmpresaId: conta.id,
            importacaoId: importacao.id,
            origem: 'asaas_ofx',
            mes: mesL,
            ano: anoL,
            favorecido: null,
            planoConta: String(l.planoConta || '').trim(),
            grupoConta: String(l.grupoConta || 'Despesas').trim(),
            tipo: String(l.tipoLancamento || 'geral'),
            subtipo: l.subtipo || null,
            descricao: l.descricao ? String(l.descricao).trim() : null,
            dataCompetencia: dataComp,
            valor: Number(l.valor),
            statusPg: 'pago',
            dataPagamento: dataComp,
            formaPagamento: 'PIX',
            banco: 'ASAAS',
            observacoes: l.observacoes || null,
            previsto: false,
          }
        })

      if (dados.length > 0) {
        await prisma.lancamentoEmpresa.createMany({ data: dados })
      }
      await prisma.importacaoEmpresa.update({
        where: { id: importacao.id },
        data: { status: 'concluido', linhasProcessadas: dados.length },
      })

      // Recalcula meses únicos afetados
      const mesesAfetados = new Set(dados.map((d: any) => `${d.mes}-${d.ano}`))
      for (const chave of mesesAfetados) {
        const [m, a] = (chave as string).split('-').map(Number)
        await calcularFechamentoEmpresa(conta.id, m, a)
      }

      const fechamento = await calcularFechamentoEmpresa(conta.id, Number(mes), Number(ano))
      return Response.json({
        ok: true,
        inseridos: dados.length,
        total: dados.length,
        duplicatas: lancamentos.length - dados.length,
        fechamento,
      }, { status: 201 })
    }

    // ── Fluxo padrão (Excel, PDF, OFX Sicredi) ───────────────────────────────

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

    // Classifica lançamentos
    const dados = lancamentos.map((l: any) => {
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
        origem: origemLancamento,
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
        statusPg: l.pago ? 'pago' : (l.statusPg === 'OK PG' || l.statusPg === 'pago' ? 'pago' : 'pendente'),
        dataPagamento: l.dataPagamento ? new Date(l.dataPagamento) : null,
        formaPagamento: l.formaPagamento ? String(l.formaPagamento).trim() : null,
        banco: l.banco ? String(l.banco).trim() : null,
        observacoes: l.observacoes ? String(l.observacoes).trim() : null,
        tipo: tipoFinal,
        subtipo: subtipoFinal ?? null,
        previsto: !!l.previsto,
      }
    })

    // ── Busca lançamentos já existentes no mesmo mês/ano ──────────────────────
    const jaExistentes = await prisma.lancamentoEmpresa.findMany({
      where: { contaEmpresaId: conta.id, mes: Number(mes), ano: Number(ano) },
      select: { id: true, dataCompetencia: true, valor: true, descricao: true, statusPg: true, tipo: true, origem: true, observacoes: true },
    })

    const conciliadosManualIds: string[] = []

    // Para OFX Sicredi: dedup por FITID (observacoes = "ofx:FITID") tem prioridade
    const fitidsOFXJaImportados = tipo === 'ofx_sicredi'
      ? new Set(jaExistentes.filter(e => e.observacoes?.startsWith('ofx:')).map(e => e.observacoes!.replace('ofx:', '')))
      : new Set<string>()

    const dadosFiltrados = dados.filter(d => {
      // Dedup por FITID (OFX Sicredi)
      if (tipo === 'ofx_sicredi' && d.observacoes?.startsWith('ofx:')) {
        const fitid = d.observacoes.replace('ofx:', '')
        if (fitidsOFXJaImportados.has(fitid)) return false
      }

      // Dedup exato por data+valor+descrição (evita reimportar mesmo arquivo)
      const chaveExata = `${d.dataCompetencia?.toISOString().slice(0, 10)}|${Number(d.valor).toFixed(2)}|${(d.descricao || '').toLowerCase().trim()}`
      const duplicataExata = jaExistentes.some(e =>
        `${e.dataCompetencia?.toISOString().slice(0, 10)}|${Number(e.valor).toFixed(2)}|${(e.descricao || '').toLowerCase().trim()}` === chaveExata
      )
      if (duplicataExata) return false

      // Conciliação por valor+data — marca lançamentos manuais como pagos
      if (d.dataCompetencia) {
        const valorD = Number(d.valor)
        const match = jaExistentes.find(e => {
          if (!e.dataCompetencia || conciliadosManualIds.includes(e.id)) return false
          if (e.tipo !== d.tipo) return false
          const diffValor = Math.abs(Number(e.valor) - valorD) / (Math.max(valorD, Number(e.valor)) || 1)
          if (diffValor > 0.05) return false
          const diffDias = Math.abs(new Date(e.dataCompetencia).getTime() - d.dataCompetencia!.getTime()) / 86400000
          return diffDias <= 7
        })
        if (match) {
          conciliadosManualIds.push(match.id)
          return false
        }
      }

      return true
    })

    // Marca lançamentos manuais conciliados como pagos
    if (conciliadosManualIds.length > 0) {
      await prisma.lancamentoEmpresa.updateMany({
        where: { id: { in: conciliadosManualIds } },
        data: { statusPg: 'pago', dataPagamento: new Date() },
      })
    }

    // ── Conciliação de lancamentos Asaas quando importando OFX Sicredi ────────
    // As transferenciasAsaas são os créditos do CNPJ próprio no extrato Sicredi.
    // Cada uma corresponde a uma transferência do saldo Asaas para o Sicredi.
    // Marcamos os asaas_webhook lancamentos do período como conciliado: true.
    let conciliadosAsaas = 0
    if (tipo === 'ofx_sicredi' && Array.isArray(transferenciasAsaas) && transferenciasAsaas.length > 0) {
      // Usa a data da última transferência como limite superior do período conciliado
      const datasTransf = transferenciasAsaas.map((t: any) => t.data).sort()
      const ultimaTransfData = datasTransf[datasTransf.length - 1]

      const resultado = await prisma.lancamentoEmpresa.updateMany({
        where: {
          contaEmpresaId: conta.id,
          origem: 'asaas_webhook',
          conciliado: false,
          mes: Number(mes),
          ano: Number(ano),
          dataCompetencia: { lte: new Date(ultimaTransfData + 'T23:59:59Z') },
        },
        data: { conciliado: true },
      })
      conciliadosAsaas = resultado.count
    }

    // ── Conciliação com Contas a Pagar ────────────────────────────────────────
    let conciliadosContasPagar = 0

    if (isPdfImport) {
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
      const dadosParaInserir: typeof dadosFiltrados = []

      for (const d of dadosFiltrados) {
        if (d.tipo === 'receita') { dadosParaInserir.push(d); continue }
        const valorD = Number(d.valor)
        const dataD = d.dataCompetencia

        const match = contasAbertas.find(c => {
          if (contasPagasIds.includes(c.id)) return false
          const valorC = Number(c.valor)
          const diffValor = Math.abs(valorC - valorD) / (valorC || 1)
          if (diffValor > 0.05) return false
          if (!dataD) return false
          const diffDias = Math.abs(new Date(c.vencimento).getTime() - dataD.getTime()) / 86400000
          return diffDias <= 7
        })

        if (match) {
          contasPagasIds.push(match.id)
          conciliadosContasPagar++
        }
        dadosParaInserir.push(d)
      }

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
        data: { status: 'concluido', linhasProcessadas: dadosParaInserir.length + conciliadosManualIds.length },
      })

      const fechamento = await calcularFechamentoEmpresa(conta.id, Number(mes), Number(ano))
      return Response.json({
        ok: true,
        inseridos: dadosParaInserir.length,
        total: dadosParaInserir.length,
        duplicatas: dados.length - dadosFiltrados.length,
        conciliadosManual: conciliadosManualIds.length,
        conciliadosContasPagar,
        conciliadosAsaas,
        fechamento,
      }, { status: 201 })
    }

    // Fluxo Excel (não-PDF)
    if (dadosFiltrados.length > 0) {
      await prisma.lancamentoEmpresa.createMany({ data: dadosFiltrados })
    }
    await prisma.importacaoEmpresa.update({
      where: { id: importacao.id },
      data: { status: 'concluido', linhasProcessadas: dadosFiltrados.length },
    })

    const fechamento = await calcularFechamentoEmpresa(conta.id, Number(mes), Number(ano))
    return Response.json({
      ok: true,
      total: dadosFiltrados.length,
      inseridos: dadosFiltrados.length,
      duplicatas: dados.length - dadosFiltrados.length,
      conciliadosAsaas,
      fechamento,
    }, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

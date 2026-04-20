import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { classificar } from '@/server/lib/classificador'
import { calcularFechamentoEmpresa } from '@/server/lib/calcularFechamentoEmpresa'

export const maxDuration = 60

// POST /api/v2/empresa/importar
// Recebe lancamentos[] já parseados pelo frontend (xlsx ou pdf), classifica e salva
export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const body = await req.json()
    const { lancamentos, mes, ano, tipo, nomeArquivo } = body
    // PDF e OFX têm dados reais de transação — ativam conciliação automática
    const isTransactionImport = tipo === 'extrato_pdf' || tipo === 'ofx_sicredi'
    const isPdfImport = isTransactionImport // compatibilidade com lógica abaixo

    // Mapeia tipo de importação para origem do lançamento
    const origemMap: Record<string, string> = {
      extrato_pdf: 'importacao',
      ofx_sicredi: 'ofx_sicredi',
      receitas: 'importacao',
      despesas: 'importacao',
    }
    const origemLancamento = origemMap[tipo] || 'importacao'

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

    // Classifica lançamentos
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

    // ── Busca lançamentos já existentes no mesmo mês/ano ───────────────────────
    const jaExistentes = await prisma.lancamentoEmpresa.findMany({
      where: { contaEmpresaId: conta.id, mes: Number(mes), ano: Number(ano) },
      select: { id: true, dataCompetencia: true, valor: true, descricao: true, statusPg: true, tipo: true, origem: true },
    })

    // ids de lançamentos existentes a marcar como pago (conciliação)
    const conciliadosManualIds: string[] = []

    const dadosFiltrados = dados.filter(d => {
      // 1) Dedup exato por data+valor+descrição (evita importar mesmo arquivo duas vezes)
      const chaveExata = `${d.dataCompetencia?.toISOString().slice(0, 10)}|${Number(d.valor).toFixed(2)}|${(d.descricao || '').toLowerCase().trim()}`
      const duplicataExata = jaExistentes.some(e =>
        `${e.dataCompetencia?.toISOString().slice(0, 10)}|${Number(e.valor).toFixed(2)}|${(e.descricao || '').toLowerCase().trim()}` === chaveExata
      )
      if (duplicataExata) return false

      // 2) Conciliação por valor+data para QUALQUER tipo de importação
      //    Evita duplicatas quando já existe lançamento com mesmo valor/data mas descrição diferente
      //    (ex: manual "Aluguel" == importado "PAGAMENTO PIX - IMOBILIARIA")
      if (d.dataCompetencia) {
        const valorD = Number(d.valor)
        const match = jaExistentes.find(e => {
          if (!e.dataCompetencia || conciliadosManualIds.includes(e.id)) return false
          // Mesmo tipo (receita vs despesa)
          if (e.tipo !== d.tipo) return false
          const diffValor = Math.abs(Number(e.valor) - valorD) / (Math.max(valorD, Number(e.valor)) || 1)
          if (diffValor > 0.05) return false
          const diffDias = Math.abs(new Date(e.dataCompetencia).getTime() - d.dataCompetencia!.getTime()) / 86400000
          return diffDias <= 7
        })
        if (match) {
          conciliadosManualIds.push(match.id)
          return false // não cria novo lançamento — já existe um equivalente
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

    // ── Conciliação com Contas a Pagar ─────────────────────────────────────────
    // Para despesas do PDF sem lançamento manual correspondente,
    // verifica se existe uma conta a pagar que bata (valor ±5%, data ±7 dias).
    // Se sim, marca conta como paga e não cria lançamento duplicado.
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
        if (d.tipo === 'receita') {
          dadosParaInserir.push(d)
          continue
        }
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
          // Cria lançamento mesmo assim para o DRE registrar a despesa
          dadosParaInserir.push(d)
        } else {
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
      fechamento,
    }, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

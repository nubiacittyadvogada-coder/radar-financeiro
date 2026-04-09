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

    // Deduplicação: evita inserir lançamentos já existentes (mesmo data + valor + descrição)
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

import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import * as XLSX from 'xlsx'
import PDFDocument from 'pdfkit'

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtN = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// GET /api/v2/pessoal/relatorio?tipo=excel|pdf&modo=mensal|anual&mes=X&ano=Y
export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return new Response('Não autorizado', { status: 401 })

    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return new Response('Conta não encontrada', { status: 404 })

    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get('tipo') || 'excel'
    const modo = searchParams.get('modo') || 'mensal'
    const mes = Number(searchParams.get('mes') || new Date().getMonth() + 1)
    const ano = Number(searchParams.get('ano') || new Date().getFullYear())

    if (modo === 'mensal') {
      const transacoes = await prisma.transacaoPessoal.findMany({
        where: { contaPessoalId: conta.id, mes, ano },
        include: { categoria: true },
        orderBy: { data: 'asc' },
      })

      const normais = transacoes.filter((t) => t.origem !== 'cartao')
      const cartao = transacoes.filter((t) => t.origem === 'cartao')
      const totalReceitas = normais.filter((t) => t.tipo === 'receita').reduce((s, t) => s + Number(t.valor), 0)
      const totalDespesas = normais.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + Number(t.valor), 0)
      const totalCartao = cartao.reduce((s, t) => s + Number(t.valor), 0)
      const saldo = totalReceitas - totalDespesas
      const taxaPoupanca = totalReceitas > 0 ? ((saldo / totalReceitas) * 100).toFixed(0) : '0'

      const catMap = new Map<string, { tipo: string; total: number }>()
      for (const t of normais) {
        const nome = t.categoria?.nome || 'Sem categoria'
        if (!catMap.has(nome)) catMap.set(nome, { tipo: t.tipo, total: 0 })
        catMap.get(nome)!.total += Number(t.valor)
      }

      if (tipo === 'excel') {
        const wb = XLSX.utils.book_new()

        // Sheet 1: Resumo
        const resumoData = [
          ['RELATÓRIO FINANCEIRO PESSOAL'],
          [`Período: ${MESES[mes]}/${ano}`],
          [''],
          ['RESUMO', ''],
          ['Receitas totais', fmtN(totalReceitas)],
          ['Despesas extrato', fmtN(totalDespesas)],
          ...(totalCartao > 0 ? [['Fatura cartão', fmtN(totalCartao)] as [string, string]] : []),
          ['Saldo do mês', fmtN(saldo)],
          ['Taxa de poupança', `${taxaPoupanca}%`],
          [''],
          ['POR CATEGORIA', ''],
          ['Categoria', 'Tipo', 'Total'],
          ...Array.from(catMap.entries())
            .sort((a, b) => b[1].total - a[1].total)
            .map(([nome, c]) => [nome, c.tipo === 'receita' ? 'Receita' : 'Despesa', fmtN(c.total)]),
        ]
        const wsResumo = XLSX.utils.aoa_to_sheet(resumoData)
        wsResumo['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }]
        XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo')

        // Sheet 2: Extrato
        const extratoData = [
          ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor (R$)'],
          ...normais.map((t) => [
            t.data ? new Date(t.data).toLocaleDateString('pt-BR') : '',
            t.descricao || '',
            t.categoria?.nome || 'Sem categoria',
            t.tipo === 'receita' ? 'Receita' : 'Despesa',
            fmtN(Number(t.valor)),
          ]),
        ]
        const wsExtrato = XLSX.utils.aoa_to_sheet(extratoData)
        wsExtrato['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 20 }, { wch: 10 }, { wch: 15 }]
        XLSX.utils.book_append_sheet(wb, wsExtrato, 'Extrato')

        // Sheet 3: Cartão (se houver)
        if (cartao.length > 0) {
          const ccMap = new Map<string, number>()
          for (const t of cartao) {
            const nome = t.categoria?.nome || 'Outros'
            ccMap.set(nome, (ccMap.get(nome) || 0) + Number(t.valor))
          }
          const cartaoData = [
            ['CARTÃO DE CRÉDITO — FATURA'],
            [`Total: ${fmtN(totalCartao)}`],
            [''],
            ['Categoria', 'Total (R$)', '% da Fatura'],
            ...Array.from(ccMap.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([nome, val]) => [nome, fmtN(val), `${((val / totalCartao) * 100).toFixed(0)}%`]),
            [''],
            ['Data', 'Descrição', 'Categoria', 'Valor (R$)', 'Cartão'],
            ...cartao.map((t) => [
              t.data ? new Date(t.data).toLocaleDateString('pt-BR') : '',
              t.descricao || '',
              t.categoria?.nome || 'Outros',
              fmtN(Number(t.valor)),
              t.cartao || '',
            ]),
          ]
          const wsCartao = XLSX.utils.aoa_to_sheet(cartaoData)
          wsCartao['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 20 }]
          XLSX.utils.book_append_sheet(wb, wsCartao, 'Cartão')
        }

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
        return new Response(new Uint8Array(buf), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="financas-pessoal-${MESES[mes]}-${ano}.xlsx"`,
          },
        })
      }

      if (tipo === 'pdf') {
        const buf = await gerarPdfMensal({ mes, ano, totalReceitas, totalDespesas, totalCartao, saldo, taxaPoupanca, catMap, transacoes: normais, cartao })
        return new Response(new Uint8Array(buf), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="financas-pessoal-${MESES[mes]}-${ano}.pdf"`,
          },
        })
      }
    }

    if (modo === 'anual') {
      const transacoes = await prisma.transacaoPessoal.findMany({
        where: { contaPessoalId: conta.id, ano },
        include: { categoria: true },
        orderBy: [{ mes: 'asc' }, { data: 'asc' }],
      })

      // Agrupa por mês
      type MesInfo = { receitas: number; despesas: number; cartao: number }
      const mesesData = new Map<number, MesInfo>()
      for (let m = 1; m <= 12; m++) mesesData.set(m, { receitas: 0, despesas: 0, cartao: 0 })
      for (const t of transacoes) {
        const m = mesesData.get(t.mes)!
        if (t.origem === 'cartao') m.cartao += Number(t.valor)
        else if (t.tipo === 'receita') m.receitas += Number(t.valor)
        else m.despesas += Number(t.valor)
      }

      const totaisAnuais = Array.from(mesesData.values())
      const totalReceitasAno = totaisAnuais.reduce((s, m) => s + m.receitas, 0)
      const totalDespesasAno = totaisAnuais.reduce((s, m) => s + m.despesas, 0)
      const totalCartaoAno = totaisAnuais.reduce((s, m) => s + m.cartao, 0)

      if (tipo === 'excel') {
        const wb = XLSX.utils.book_new()

        // Sheet 1: Resumo anual
        const resumoData = [
          ['RELATÓRIO FINANCEIRO PESSOAL — ANUAL'],
          [`Ano: ${ano}`],
          [''],
          ['Mês', 'Receitas', 'Despesas', 'Cartão', 'Saldo'],
          ...Array.from(mesesData.entries()).map(([m, d]) => [
            MESES[m], fmtN(d.receitas), fmtN(d.despesas), fmtN(d.cartao), fmtN(d.receitas - d.despesas),
          ]),
          [''],
          ['TOTAL', fmtN(totalReceitasAno), fmtN(totalDespesasAno), fmtN(totalCartaoAno), fmtN(totalReceitasAno - totalDespesasAno)],
          ['Taxa poupança anual', `${totalReceitasAno > 0 ? (((totalReceitasAno - totalDespesasAno) / totalReceitasAno) * 100).toFixed(0) : 0}%`],
        ]
        const wsResumo = XLSX.utils.aoa_to_sheet(resumoData)
        wsResumo['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }]
        XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Anual')

        // Sheet 2: Todas as transações
        const txData = [
          ['Mês', 'Data', 'Descrição', 'Categoria', 'Tipo', 'Cartão', 'Valor (R$)'],
          ...transacoes.map((t) => [
            MESES[t.mes],
            t.data ? new Date(t.data).toLocaleDateString('pt-BR') : '',
            t.descricao || '',
            t.categoria?.nome || 'Sem categoria',
            t.origem === 'cartao' ? 'Cartão CC' : t.tipo === 'receita' ? 'Receita' : 'Despesa',
            t.cartao || '',
            fmtN(Number(t.valor)),
          ]),
        ]
        const wsTx = XLSX.utils.aoa_to_sheet(txData)
        wsTx['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 15 }]
        XLSX.utils.book_append_sheet(wb, wsTx, 'Transações')

        // Sheet 3: Por categoria no ano
        const catAnual = new Map<string, { tipo: string; total: number; meses: number }>()
        for (const t of transacoes) {
          const nome = t.categoria?.nome || 'Sem categoria'
          const tipo = t.origem === 'cartao' ? 'cartao' : t.tipo
          if (!catAnual.has(nome)) catAnual.set(nome, { tipo, total: 0, meses: 0 })
          catAnual.get(nome)!.total += Number(t.valor)
        }
        const catData = [
          ['Categoria', 'Tipo', 'Total Ano (R$)', 'Média Mês (R$)'],
          ...Array.from(catAnual.entries())
            .sort((a, b) => b[1].total - a[1].total)
            .map(([nome, c]) => [
              nome,
              c.tipo === 'receita' ? 'Receita' : c.tipo === 'cartao' ? 'Cartão CC' : 'Despesa',
              fmtN(c.total),
              fmtN(c.total / 12),
            ]),
        ]
        const wsCat = XLSX.utils.aoa_to_sheet(catData)
        wsCat['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 18 }, { wch: 18 }]
        XLSX.utils.book_append_sheet(wb, wsCat, 'Por Categoria')

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
        return new Response(new Uint8Array(buf), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="financas-pessoal-${ano}.xlsx"`,
          },
        })
      }

      if (tipo === 'pdf') {
        const buf = await gerarPdfAnual({ ano, mesesData, totalReceitasAno, totalDespesasAno, totalCartaoAno })
        return new Response(new Uint8Array(buf), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="financas-pessoal-${ano}.pdf"`,
          },
        })
      }
    }

    return new Response('Parâmetros inválidos', { status: 400 })
  } catch (err: any) {
    return new Response(err.message, { status: 500 })
  }
}

// ── PDF mensal ─────────────────────────────────────────────────────────────
async function gerarPdfMensal(opts: {
  mes: number; ano: number
  totalReceitas: number; totalDespesas: number; totalCartao: number
  saldo: number; taxaPoupanca: string
  catMap: Map<string, { tipo: string; total: number }>
  transacoes: any[]; cartao: any[]
}): Promise<Buffer> {
  const { mes, ano, totalReceitas, totalDespesas, totalCartao, saldo, taxaPoupanca, catMap, transacoes, cartao } = opts

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Relatório ${MESES[mes]}/${ano}`, Author: 'Radar Financeiro' } })
    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = 515 // largura útil

    // Header
    doc.rect(0, 0, 595, 70).fill('#16a34a')
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
      .text('Relatório Financeiro Pessoal', 40, 18)
    doc.fontSize(11).font('Helvetica')
      .text(`${MESES[mes]} de ${ano}`, 40, 44)
    doc.fillColor('#1f2937')

    // KPIs
    doc.y = 90
    const kpis = [
      { label: 'Receitas', valor: totalReceitas, cor: '#16a34a' },
      { label: 'Despesas', valor: totalDespesas, cor: '#dc2626' },
      ...(totalCartao > 0 ? [{ label: 'Cartão', valor: totalCartao, cor: '#2563eb' }] : []),
      { label: saldo >= 0 ? 'Saldo ✓' : 'Saldo ✗', valor: saldo, cor: saldo >= 0 ? '#16a34a' : '#dc2626' },
    ]
    const kpiW = W / kpis.length
    kpis.forEach((k, i) => {
      const x = 40 + i * kpiW
      doc.rect(x, 90, kpiW - 8, 55).fillAndStroke('#f9fafb', '#e5e7eb')
      doc.fillColor('#6b7280').fontSize(8).font('Helvetica').text(k.label.toUpperCase(), x + 8, 97)
      doc.fillColor(k.cor).fontSize(13).font('Helvetica-Bold')
        .text(fmt(Math.abs(k.valor)), x + 8, 111, { width: kpiW - 16 })
      if (k.label.startsWith('Saldo')) {
        doc.fillColor('#6b7280').fontSize(8).font('Helvetica')
          .text(`Poupança: ${taxaPoupanca}%`, x + 8, 130)
      }
    })
    doc.fillColor('#1f2937')

    // Categorias
    doc.y = 160
    doc.fontSize(11).font('Helvetica-Bold').text('Por Categoria', 40)
    doc.moveDown(0.3)

    const cats = Array.from(catMap.entries()).sort((a, b) => b[1].total - a[1].total)
    const maxCatVal = Math.max(...cats.map((c) => c[1].total), 1)

    for (const [nome, c] of cats) {
      if (doc.y > 700) { doc.addPage(); doc.y = 40 }
      const barW = Math.max(4, ((c.total / maxCatVal) * (W - 150)))
      const cor = c.tipo === 'receita' ? '#16a34a' : '#3b82f6'
      doc.fontSize(9).font('Helvetica').fillColor('#374151').text(nome, 40, doc.y, { width: 130 })
      doc.rect(175, doc.y - 10, barW, 10).fill(cor)
      doc.fillColor(cor).fontSize(9).font('Helvetica-Bold')
        .text(fmt(c.total), 180 + barW, doc.y - 10, { width: 120, align: 'left' })
      doc.fillColor('#1f2937')
      doc.moveDown(0.6)
    }

    // Transações
    if (doc.y > 620) { doc.addPage(); doc.y = 40 }
    doc.moveDown(0.5)
    doc.fontSize(11).font('Helvetica-Bold').text('Transações do extrato', 40)
    doc.moveDown(0.3)

    // Cabeçalho tabela
    doc.rect(40, doc.y, W, 16).fill('#f3f4f6')
    doc.fillColor('#374151').fontSize(8).font('Helvetica-Bold')
    doc.text('Data', 44, doc.y + 3)
    doc.text('Descrição', 100, doc.y + 3)
    doc.text('Categoria', 330, doc.y + 3)
    doc.text('Valor', 450, doc.y + 3)
    doc.moveDown(1.3)

    for (const t of transacoes.slice(0, 60)) {
      if (doc.y > 760) { doc.addPage(); doc.y = 40 }
      const isReceita = t.tipo === 'receita'
      doc.fontSize(8).font('Helvetica').fillColor('#374151')
      doc.text(t.data ? new Date(t.data).toLocaleDateString('pt-BR') : '', 44, doc.y, { width: 54 })
      doc.text((t.descricao || '').substring(0, 35), 100, doc.y, { width: 225 })
      doc.text((t.categoria?.nome || 'Sem categoria').substring(0, 22), 330, doc.y, { width: 115 })
      doc.fillColor(isReceita ? '#16a34a' : '#dc2626')
        .text(`${isReceita ? '+' : '-'} ${fmt(Number(t.valor))}`, 450, doc.y, { width: 100 })
      doc.fillColor('#1f2937')
      doc.moveDown(0.8)
    }

    // Cartão (se houver)
    if (cartao.length > 0) {
      if (doc.y > 620) { doc.addPage(); doc.y = 40 }
      doc.moveDown(0.5)
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#2563eb').text(`💳 Cartão de Crédito — ${fmt(totalCartao)}`, 40)
      doc.fillColor('#1f2937')
      doc.moveDown(0.3)
      const ccMap = new Map<string, number>()
      for (const t of cartao) ccMap.set(t.categoria?.nome || 'Outros', (ccMap.get(t.categoria?.nome || 'Outros') || 0) + Number(t.valor))
      for (const [nome, val] of Array.from(ccMap.entries()).sort((a, b) => b[1] - a[1])) {
        if (doc.y > 760) { doc.addPage(); doc.y = 40 }
        doc.fontSize(9).font('Helvetica').fillColor('#374151').text(nome, 44, doc.y, { width: 200 })
        doc.fillColor('#2563eb').text(fmt(val), 250, doc.y)
        doc.fillColor('#9ca3af').text(`${((val / totalCartao) * 100).toFixed(0)}%`, 370, doc.y)
        doc.fillColor('#1f2937')
        doc.moveDown(0.8)
      }
    }

    // Footer
    doc.fontSize(7).fillColor('#9ca3af')
      .text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} · Radar Financeiro`, 40, 810, { align: 'center', width: W })

    doc.end()
  })
}

// ── PDF anual ──────────────────────────────────────────────────────────────
async function gerarPdfAnual(opts: {
  ano: number
  mesesData: Map<number, { receitas: number; despesas: number; cartao: number }>
  totalReceitasAno: number; totalDespesasAno: number; totalCartaoAno: number
}): Promise<Buffer> {
  const { ano, mesesData, totalReceitasAno, totalDespesasAno, totalCartaoAno } = opts

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Relatório Anual ${ano}`, Author: 'Radar Financeiro' } })
    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = 515

    // Header
    doc.rect(0, 0, 595, 70).fill('#16a34a')
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold').text('Relatório Financeiro Pessoal', 40, 18)
    doc.fontSize(11).font('Helvetica').text(`Ano ${ano} — Visão Geral`, 40, 44)
    doc.fillColor('#1f2937')

    // KPIs anuais
    const saldoAno = totalReceitasAno - totalDespesasAno
    const taxa = totalReceitasAno > 0 ? ((saldoAno / totalReceitasAno) * 100).toFixed(0) : '0'
    const kpis = [
      { label: 'Receitas', valor: totalReceitasAno, cor: '#16a34a' },
      { label: 'Despesas', valor: totalDespesasAno, cor: '#dc2626' },
      { label: 'Cartão', valor: totalCartaoAno, cor: '#2563eb' },
      { label: 'Saldo', valor: saldoAno, cor: saldoAno >= 0 ? '#16a34a' : '#dc2626' },
    ]
    const kpiW = W / 4
    kpis.forEach((k, i) => {
      const x = 40 + i * kpiW
      doc.rect(x, 90, kpiW - 6, 55).fillAndStroke('#f9fafb', '#e5e7eb')
      doc.fillColor('#6b7280').fontSize(8).font('Helvetica').text(k.label.toUpperCase(), x + 6, 97)
      doc.fillColor(k.cor).fontSize(12).font('Helvetica-Bold')
        .text(fmt(Math.abs(k.valor)), x + 6, 111, { width: kpiW - 12 })
      if (k.label === 'Saldo') doc.fillColor('#6b7280').fontSize(8).font('Helvetica').text(`Poupança: ${taxa}%`, x + 6, 130)
    })
    doc.fillColor('#1f2937')

    // Tabela mês a mês
    doc.y = 160
    doc.fontSize(11).font('Helvetica-Bold').text('Mês a Mês', 40)
    doc.moveDown(0.4)

    // Cabeçalho
    doc.rect(40, doc.y, W, 16).fill('#f3f4f6')
    doc.fillColor('#374151').fontSize(8).font('Helvetica-Bold')
    doc.text('Mês', 44, doc.y + 3)
    doc.text('Receitas', 130, doc.y + 3)
    doc.text('Despesas', 220, doc.y + 3)
    doc.text('Cartão', 310, doc.y + 3)
    doc.text('Saldo', 400, doc.y + 3)
    doc.moveDown(1.4)

    for (let m = 1; m <= 12; m++) {
      const d = mesesData.get(m)!
      if (d.receitas === 0 && d.despesas === 0 && d.cartao === 0) continue
      const saldoMes = d.receitas - d.despesas
      const cor = saldoMes >= 0 ? '#16a34a' : '#dc2626'
      if (m % 2 === 0) doc.rect(40, doc.y - 2, W, 14).fill('#fafafa')
      doc.fillColor('#374151').fontSize(8).font('Helvetica')
        .text(MESES[m], 44, doc.y, { width: 84 })
        .text(fmtN(d.receitas), 130, doc.y, { width: 84 })
        .text(fmtN(d.despesas), 220, doc.y, { width: 84 })
        .text(fmtN(d.cartao), 310, doc.y, { width: 84 })
      doc.fillColor(cor).text(`${saldoMes >= 0 ? '+' : ''}${fmtN(saldoMes)}`, 400, doc.y, { width: 115 })
      doc.fillColor('#1f2937')
      doc.moveDown(1)
    }

    // Total
    doc.rect(40, doc.y, W, 16).fill('#e5e7eb')
    doc.fillColor('#111827').fontSize(9).font('Helvetica-Bold')
      .text('TOTAL', 44, doc.y + 3)
      .text(fmtN(totalReceitasAno), 130, doc.y + 3)
      .text(fmtN(totalDespesasAno), 220, doc.y + 3)
      .text(fmtN(totalCartaoAno), 310, doc.y + 3)
    doc.fillColor(saldoAno >= 0 ? '#16a34a' : '#dc2626')
      .text(`${saldoAno >= 0 ? '+' : ''}${fmtN(saldoAno)}`, 400, doc.y + 3)

    doc.fontSize(7).fillColor('#9ca3af')
      .text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} · Radar Financeiro`, 40, 810, { align: 'center', width: W })

    doc.end()
  })
}

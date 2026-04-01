import PDFDocument from 'pdfkit'
import prisma from './db'

const MESES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export async function gerarRelatorioPdf(
  clienteId: string,
  mes: number,
  ano: number
): Promise<Buffer> {
  const fechamento = await prisma.fechamento.findUnique({
    where: { clienteId_mes_ano: { clienteId, mes, ano } },
    include: { cliente: { include: { bpo: true } } },
  })

  if (!fechamento) {
    throw new Error('Fechamento não encontrado para o período')
  }

  // Buscar fechamento anterior para comparativo
  const mesAnt = mes === 1 ? 12 : mes - 1
  const anoAnt = mes === 1 ? ano - 1 : ano
  const anterior = await prisma.fechamento.findUnique({
    where: { clienteId_mes_ano: { clienteId, mes: mesAnt, ano: anoAnt } },
  })

  // Top 5 maiores despesas
  const maioresDespesas = await prisma.lancamento.findMany({
    where: {
      clienteId, mes, ano,
      previsto: false,
      tipo: { in: ['pessoal', 'marketing', 'geral', 'custo_direto'] },
    },
    orderBy: { valor: 'asc' },
    take: 5,
  })

  // Alertas ativos
  const alertas = await prisma.alerta.findMany({
    where: { clienteId },
    orderBy: { criadoEm: 'desc' },
    take: 1,
  })

  // Gerar PDF em memória
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: {
      Title: `DRE – ${MESES[mes]}/${ano}`,
      Author: 'Radar Financeiro',
    }})

    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageWidth = doc.page.width - 80

    // === CABEÇALHO ===
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e3a5f').text('RADAR FINANCEIRO', 40, 40)
    doc.fontSize(9).font('Helvetica').fillColor('#666').text(fechamento.cliente.bpo.nome, 40, 62)
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text(fechamento.cliente.nomeEmpresa, 40, 78)
    doc.fontSize(10).font('Helvetica').fillColor('#444').text(
      `Demonstrativo de Resultado do Exercício — ${MESES[mes]} / ${ano}`, 40, 96
    )
    doc.moveTo(40, 115).lineTo(40 + pageWidth, 115).lineWidth(1.5).stroke('#1e3a5f')

    // === RESULTADO DESTAQUE ===
    const lucro = Number(fechamento.lucroLiquido)
    const corResultado = lucro >= 0 ? '#16a34a' : '#dc2626'
    doc.fontSize(15).font('Helvetica-Bold').fillColor(corResultado)
      .text(
        lucro >= 0
          ? `Resultado: Lucro de R$ ${fmt(lucro)}`
          : `Resultado: Prejuízo de R$ ${fmt(Math.abs(lucro))}`,
        40, 124, { align: 'center', width: pageWidth }
      )

    doc.moveTo(40, 148).lineTo(40 + pageWidth, 148).lineWidth(0.5).stroke('#ccc')

    // === 4 INDICADORES ===
    let y = 158
    const colW = pageWidth / 4
    const indicadores = [
      { label: 'Receita Bruta', valor: `R$ ${fmt(Number(fechamento.receitaBruta))}`, cor: '#2563eb' },
      { label: 'Margem', valor: `${Number(fechamento.percMargem).toFixed(1)}%`, cor: '#7c3aed' },
      { label: 'Lucro Operacional', valor: `R$ ${fmt(Number(fechamento.lucroOperacional))}`, cor: lucro >= 0 ? '#16a34a' : '#dc2626' },
      { label: 'Saldo Final de Caixa', valor: `R$ ${fmt(Number(fechamento.saldoFinal || 0))}`, cor: '#0891b2' },
    ]
    indicadores.forEach((ind, idx) => {
      const x = 40 + idx * colW
      doc.fontSize(7).font('Helvetica').fillColor('#888').text(ind.label, x, y, { width: colW, align: 'center' })
      doc.fontSize(11).font('Helvetica-Bold').fillColor(ind.cor).text(ind.valor, x, y + 13, { width: colW, align: 'center' })
    })

    y += 40
    doc.moveTo(40, y).lineTo(40 + pageWidth, y).stroke('#ccc')
    y += 12

    // === DRE COMPLETA ===
    const dreY = y
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text('DRE — Demonstrativo de Resultado', 40, y)
    y += 18

    // Cabeçalho da tabela
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#888')
      .text('DESCRIÇÃO', 50, y, { width: 280 })
      .text('VALOR (R$)', 330, y, { width: 120, align: 'right' })
      .text('%', 450, y, { width: 50, align: 'right' })
    y += 12
    doc.moveTo(40, y).lineTo(40 + pageWidth, y).stroke('#ddd')
    y += 6

    const receitaBruta = Number(fechamento.receitaBruta)

    function linhaGrande(label: string, valor: number, cor = '#000') {
      doc.moveTo(40, y - 2).lineTo(40 + pageWidth, y - 2).lineWidth(0.3).stroke('#e5e7eb')
      doc.fontSize(9).font('Helvetica-Bold').fillColor(cor)
        .text(label, 50, y, { width: 280 })
        .text(`R$ ${fmt(valor)}`, 330, y, { width: 120, align: 'right' })
        .text(receitaBruta ? `${((valor / receitaBruta) * 100).toFixed(1)}%` : '-', 450, y, { width: 50, align: 'right' })
      y += 15
    }

    function linhaPequena(label: string, valor: number) {
      doc.fontSize(8).font('Helvetica').fillColor('#444')
        .text(label, 60, y, { width: 270 })
        .text(`R$ ${fmt(valor)}`, 330, y, { width: 120, align: 'right' })
        .text(receitaBruta ? `${((valor / receitaBruta) * 100).toFixed(1)}%` : '-', 450, y, { width: 50, align: 'right' })
      y += 13
    }

    // Receita
    linhaGrande('Receita Bruta', Number(fechamento.receitaBruta), '#1e3a5f')
    linhaPequena('  (-) Repasse Êxito / Parceria', -Number(fechamento.repasseExito))
    linhaPequena('  (-) Impostos e Tributos', -Number(fechamento.impostos))
    linhaGrande('= Receita Líquida', Number(fechamento.receitaLiquida), '#1e3a5f')
    y += 3

    // Custos e Margem
    linhaPequena('  (-) Custos Diretos', -Number(fechamento.custosDiretos))
    linhaGrande('= Margem de Contribuição', Number(fechamento.margemContribuicao),
      Number(fechamento.margemContribuicao) >= 0 ? '#16a34a' : '#dc2626')
    y += 3

    // Despesas ADM detalhadas
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#444')
      .text('(-) Despesas Administrativas', 50, y, { width: 280 })
      .text(`R$ ${fmt(Number(fechamento.totalDespesasAdm))}`, 330, y, { width: 120, align: 'right' })
    y += 13
    linhaPequena('      Pessoal / Folha', -Number(fechamento.despesasPessoal))
    linhaPequena('      Marketing / Publicidade', -Number(fechamento.despesasMarketing))
    linhaPequena('      Despesas Gerais', -Number(fechamento.despesasGerais))
    y += 3

    linhaGrande('= Lucro Operacional', Number(fechamento.lucroOperacional),
      Number(fechamento.lucroOperacional) >= 0 ? '#16a34a' : '#dc2626')
    y += 3

    // Abaixo do lucro operacional
    linhaPequena('  (-) Retirada de Sócios', -Number(fechamento.retiradaSocios))
    linhaPequena('  (+/-) Resultado Financeiro', Number(fechamento.resultadoFinanceiro))

    y += 4
    doc.moveTo(40, y).lineTo(40 + pageWidth, y).lineWidth(1).stroke('#1e3a5f')
    y += 6
    linhaGrande('= LUCRO LÍQUIDO', Number(fechamento.lucroLiquido),
      lucro >= 0 ? '#16a34a' : '#dc2626')

    if (fechamento.saldoFinal) {
      y += 4
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0891b2')
        .text('Saldo Final de Caixa', 50, y, { width: 280 })
        .text(`R$ ${fmt(Number(fechamento.saldoFinal))}`, 330, y, { width: 120, align: 'right' })
      y += 15
    }

    y += 8
    doc.moveTo(40, y).lineTo(40 + pageWidth, y).stroke('#ccc')
    y += 12

    // === TOP 5 DESPESAS ===
    if (maioresDespesas.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e3a5f').text('Maiores Despesas do Mês', 40, y)
      y += 14

      maioresDespesas.forEach((d, idx) => {
        const nome = d.favorecido || d.planoConta
        doc.fontSize(8).font('Helvetica').fillColor('#333')
          .text(`${idx + 1}. ${nome}`, 50, y, { width: 300 })
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#dc2626')
          .text(`R$ ${fmt(Math.abs(Number(d.valor)))}`, 350, y, { width: 110, align: 'right' })
        y += 13
      })
      y += 6
    }

    // === COMPARATIVO ===
    if (anterior) {
      doc.moveTo(40, y).lineTo(40 + pageWidth, y).stroke('#ccc')
      y += 10
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e3a5f')
        .text(`Comparativo com ${MESES[mesAnt]}/${anoAnt}`, 40, y)
      y += 14

      const comparativos = [
        { label: 'Receita Bruta', atual: Number(fechamento.receitaBruta), ant: Number(anterior.receitaBruta) },
        { label: 'Margem de Contribuição', atual: Number(fechamento.margemContribuicao), ant: Number(anterior.margemContribuicao) },
        { label: 'Lucro Operacional', atual: Number(fechamento.lucroOperacional), ant: Number(anterior.lucroOperacional) },
        { label: 'Despesas ADM', atual: Number(fechamento.totalDespesasAdm), ant: Number(anterior.totalDespesasAdm) },
        { label: 'Retirada de Sócios', atual: Number(fechamento.retiradaSocios), ant: Number(anterior.retiradaSocios) },
        { label: 'Lucro Líquido', atual: Number(fechamento.lucroLiquido), ant: Number(anterior.lucroLiquido) },
      ]

      comparativos.forEach((c) => {
        const variacao = c.ant !== 0 ? ((c.atual - c.ant) / Math.abs(c.ant)) * 100 : 0
        const sinal = variacao >= 0 ? '+' : ''
        const isRuimSobeEhRuim = c.label === 'Despesas ADM'
        const cor = isRuimSobeEhRuim
          ? (variacao > 0 ? '#dc2626' : '#16a34a')
          : (variacao >= 0 ? '#16a34a' : '#dc2626')

        doc.fontSize(8).font('Helvetica').fillColor('#444').text(c.label, 50, y, { width: 150 })
        doc.fontSize(8).font('Helvetica').fillColor('#999').text(`R$ ${fmt(c.ant)}`, 200, y, { width: 100 })
        doc.fontSize(8).font('Helvetica').fillColor('#555').text('→', 295, y, { width: 15 })
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000').text(`R$ ${fmt(c.atual)}`, 310, y, { width: 100 })
        doc.fontSize(8).font('Helvetica-Bold').fillColor(cor).text(`${sinal}${variacao.toFixed(1)}%`, 415, y, { width: 60, align: 'right' })
        y += 13
      })
    }

    // === ALERTA ===
    if (alertas.length > 0 && y < doc.page.height - 80) {
      y += 8
      doc.rect(40, y, pageWidth, 36).fill('#fef2f2').stroke('#fca5a5')
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#991b1b').text(`⚠ ${alertas[0].titulo}`, 48, y + 6, { width: pageWidth - 16 })
      doc.fontSize(7.5).font('Helvetica').fillColor('#7f1d1d').text(alertas[0].mensagem, 48, y + 19, { width: pageWidth - 16 })
      y += 44
    }

    // === RODAPÉ ===
    const footerY = doc.page.height - 45
    doc.moveTo(40, footerY).lineTo(40 + pageWidth, footerY).stroke('#ccc')
    doc.fontSize(7.5).font('Helvetica').fillColor('#aaa')
      .text(
        `Gerado pelo Radar Financeiro | ${fechamento.cliente.bpo.nome} | ${new Date().toLocaleDateString('pt-BR')}`,
        40, footerY + 8, { align: 'center', width: pageWidth }
      )

    doc.end()
  })
}

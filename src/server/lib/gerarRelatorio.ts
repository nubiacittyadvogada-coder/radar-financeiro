import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
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
): Promise<string> {
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

  // Top 3 maiores despesas
  const maioresDespesas = await prisma.lancamento.findMany({
    where: {
      clienteId,
      mes,
      ano,
      previsto: false,
      tipo: { in: ['pessoal', 'marketing', 'geral', 'custo_direto'] },
    },
    orderBy: { valor: 'asc' },
    take: 3,
  })

  // Alertas ativos
  const alertas = await prisma.alerta.findMany({
    where: { clienteId },
    orderBy: { criadoEm: 'desc' },
    take: 1,
  })

  // Gerar PDF
  const storagePath = process.env.STORAGE_PATH || './uploads'
  const pdfDir = path.join(storagePath, 'relatorios')
  if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir, { recursive: true })
  }

  const fileName = `relatorio-${clienteId.substring(0, 8)}-${ano}-${String(mes).padStart(2, '0')}.pdf`
  const filePath = path.join(pdfDir, fileName)

  return new Promise<string>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: `Relatório Financeiro - ${MESES[mes]}/${ano}`,
        Author: 'Radar Financeiro',
      },
    })

    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    const pageWidth = doc.page.width - 80 // margens

    // === CABEÇALHO ===
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('RADAR FINANCEIRO', 40, 40)
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#666')
      .text(fechamento.cliente.bpo.nome, 40, 65)
    doc
      .fontSize(14)
      .fillColor('#000')
      .font('Helvetica-Bold')
      .text(fechamento.cliente.nomeEmpresa, 40, 85)
    doc
      .fontSize(12)
      .font('Helvetica')
      .text(`${MESES[mes]} / ${ano}`, 40, 105)

    doc.moveTo(40, 125).lineTo(40 + pageWidth, 125).stroke('#ccc')

    // === RESULTADO EM DESTAQUE ===
    const lucro = Number(fechamento.lucroLiquido)
    const corResultado = lucro >= 0 ? '#16a34a' : '#dc2626'
    const textoResultado = lucro >= 0
      ? `Você lucrou R$ ${fmt(lucro)} este mês`
      : `Este mês o resultado foi negativo em R$ ${fmt(Math.abs(lucro))}`

    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor(corResultado)
      .text(textoResultado, 40, 140, { align: 'center', width: pageWidth })

    doc.moveTo(40, 175).lineTo(40 + pageWidth, 175).stroke('#ccc')

    // === 4 INDICADORES ===
    let y = 190
    const colW = pageWidth / 4

    const indicadores = [
      { label: 'Receita Bruta', valor: Number(fechamento.receitaBruta), cor: '#2563eb' },
      { label: 'Margem', valor: Number(fechamento.percMargem), cor: '#7c3aed', sufixo: '%' },
      { label: 'Lucro Op.', valor: Number(fechamento.lucroOperacional), cor: lucro >= 0 ? '#16a34a' : '#dc2626' },
      { label: 'Caixa Final', valor: Number(fechamento.saldoFinal || 0), cor: '#0891b2' },
    ]

    indicadores.forEach((ind, idx) => {
      const x = 40 + idx * colW
      doc.fontSize(8).font('Helvetica').fillColor('#666').text(ind.label, x, y, { width: colW, align: 'center' })
      const valStr = ind.sufixo
        ? `${ind.valor.toFixed(1)}${ind.sufixo}`
        : `R$ ${fmt(ind.valor)}`
      doc.fontSize(13).font('Helvetica-Bold').fillColor(ind.cor).text(valStr, x, y + 14, { width: colW, align: 'center' })
    })

    y += 45
    doc.moveTo(40, y).lineTo(40 + pageWidth, y).stroke('#ccc')
    y += 15

    // === DRE RESUMIDA ===
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text('Demonstrativo de Resultado', 40, y)
    y += 20

    const linhasDre = [
      { label: 'Receita Bruta', valor: Number(fechamento.receitaBruta), bold: true },
      { label: '(-) Repasse Êxito', valor: -Number(fechamento.repasseExito) },
      { label: '(-) Impostos', valor: -Number(fechamento.impostos) },
      { label: '= Receita Líquida', valor: Number(fechamento.receitaLiquida), bold: true },
      { label: '(-) Custos Diretos', valor: -Number(fechamento.custosDiretos) },
      { label: '= Margem de Contribuição', valor: Number(fechamento.margemContribuicao), bold: true },
      { label: '(-) Despesas ADM', valor: -Number(fechamento.totalDespesasAdm) },
      { label: '= Lucro Operacional', valor: Number(fechamento.lucroOperacional), bold: true },
      { label: '(-) Retirada Sócios', valor: -Number(fechamento.retiradaSocios) },
      { label: '(+/-) Resultado Financeiro', valor: Number(fechamento.resultadoFinanceiro) },
      { label: '= Lucro Líquido', valor: Number(fechamento.lucroLiquido), bold: true },
    ]

    linhasDre.forEach((linha) => {
      const font = linha.bold ? 'Helvetica-Bold' : 'Helvetica'
      const cor = linha.valor < 0 ? '#dc2626' : '#000'
      doc.fontSize(9).font(font).fillColor('#333').text(linha.label, 50, y, { width: 250 })
      doc.fontSize(9).font(font).fillColor(cor).text(`R$ ${fmt(linha.valor)}`, 300, y, { width: 150, align: 'right' })
      y += 14
    })

    y += 10
    doc.moveTo(40, y).lineTo(40 + pageWidth, y).stroke('#ccc')
    y += 15

    // === TOP 3 DESPESAS ===
    if (maioresDespesas.length > 0) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text('Maiores Despesas do Mês', 40, y)
      y += 18

      maioresDespesas.forEach((d, idx) => {
        const nome = d.favorecido || d.planoConta
        doc.fontSize(9).font('Helvetica').fillColor('#333')
          .text(`${idx + 1}. ${nome}`, 50, y, { width: 300 })
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#dc2626')
          .text(`R$ ${fmt(Math.abs(Number(d.valor)))}`, 350, y, { width: 100, align: 'right' })
        y += 14
      })

      y += 10
    }

    // === COMPARATIVO ===
    if (anterior) {
      doc.moveTo(40, y).lineTo(40 + pageWidth, y).stroke('#ccc')
      y += 15

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text('Comparativo com Mês Anterior', 40, y)
      y += 18

      const comparativos = [
        { label: 'Receita', atual: Number(fechamento.receitaBruta), ant: Number(anterior.receitaBruta) },
        { label: 'Lucro Op.', atual: Number(fechamento.lucroOperacional), ant: Number(anterior.lucroOperacional) },
        { label: 'Desp. ADM', atual: Number(fechamento.totalDespesasAdm), ant: Number(anterior.totalDespesasAdm) },
      ]

      comparativos.forEach((c) => {
        const variacao = c.ant !== 0 ? ((c.atual - c.ant) / Math.abs(c.ant)) * 100 : 0
        const sinal = variacao >= 0 ? '+' : ''
        const cor = c.label === 'Desp. ADM'
          ? (variacao > 0 ? '#dc2626' : '#16a34a')
          : (variacao >= 0 ? '#16a34a' : '#dc2626')

        doc.fontSize(9).font('Helvetica').fillColor('#333').text(c.label, 50, y, { width: 120 })
        doc.fontSize(9).font('Helvetica').fillColor('#666').text(`R$ ${fmt(c.ant)} →`, 170, y, { width: 120 })
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000').text(`R$ ${fmt(c.atual)}`, 290, y, { width: 100 })
        doc.fontSize(9).font('Helvetica-Bold').fillColor(cor).text(`${sinal}${variacao.toFixed(1)}%`, 400, y, { width: 60, align: 'right' })
        y += 14
      })
    }

    // === ALERTA ===
    if (alertas.length > 0) {
      y += 15
      doc.rect(40, y, pageWidth, 40).fill('#fef2f2').stroke('#fca5a5')
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#991b1b').text(`⚠ ${alertas[0].titulo}`, 50, y + 8, { width: pageWidth - 20 })
      doc.fontSize(8).font('Helvetica').fillColor('#7f1d1d').text(alertas[0].mensagem, 50, y + 22, { width: pageWidth - 20 })
      y += 50
    }

    // === RODAPÉ ===
    const footerY = doc.page.height - 50
    doc.moveTo(40, footerY).lineTo(40 + pageWidth, footerY).stroke('#ccc')
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#999')
      .text(
        `Análise gerada pelo Radar Financeiro | ${fechamento.cliente.bpo.nome}`,
        40,
        footerY + 10,
        { align: 'center', width: pageWidth }
      )

    doc.end()

    stream.on('finish', async () => {
      // Salvar URL do PDF no fechamento
      const pdfUrl = `/relatorios/${fileName}`
      await prisma.fechamento.update({
        where: { id: fechamento.id },
        data: { pdfUrl, pdfGeradoEm: new Date() },
      })
      resolve(filePath)
    })

    stream.on('error', reject)
  })
}

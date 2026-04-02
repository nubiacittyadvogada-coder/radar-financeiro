import PDFDocument from 'pdfkit'
import prisma from './db'

const MESES_PT = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const fmt = (v: any) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtPct = (v: any) => `${Number(v || 0).toFixed(1)}%`

export async function gerarRelatorioEmpresaPdf(
  contaEmpresaId: string,
  mes: number,
  ano: number
): Promise<Buffer> {
  const fechamento = await prisma.fechamentoEmpresa.findUnique({
    where: { contaEmpresaId_mes_ano: { contaEmpresaId, mes, ano } },
    include: { contaEmpresa: true },
  })

  if (!fechamento) {
    throw new Error('Fechamento não encontrado para o período')
  }

  const mesAnt = mes === 1 ? 12 : mes - 1
  const anoAnt = mes === 1 ? ano - 1 : ano
  const anterior = await prisma.fechamentoEmpresa.findUnique({
    where: { contaEmpresaId_mes_ano: { contaEmpresaId, mes: mesAnt, ano: anoAnt } },
  })

  const maioresDespesas = await prisma.lancamentoEmpresa.findMany({
    where: {
      contaEmpresaId, mes, ano, previsto: false,
      tipo: { in: ['pessoal', 'marketing', 'geral', 'custo_direto'] },
    },
    orderBy: { valor: 'asc' },
    take: 5,
  })

  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', (chunk) => chunks.push(chunk))

  const nomeEmpresa = fechamento.contaEmpresa.nomeEmpresa || 'Empresa'

  // ── Cabeçalho ─────────────────────────────────────────────────────────────
  doc.fontSize(20).font('Helvetica-Bold').text('Radar Financeiro', 50, 50)
  doc.fontSize(12).font('Helvetica').text(`Relatório Mensal — ${nomeEmpresa}`, 50, 80)
  doc.fontSize(14).font('Helvetica-Bold')
    .text(`${MESES_PT[mes]} de ${ano}`, 50, 100)
  doc.moveTo(50, 125).lineTo(545, 125).stroke()

  let y = 140

  const row = (label: string, value: string, bold = false, indent = 0) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10)
    doc.text(label, 50 + indent, y, { width: 300 })
    doc.text(`R$ ${value}`, 350, y, { width: 195, align: 'right' })
    y += 18
  }

  const sep = () => {
    y += 4
    doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).stroke()
    y += 8
  }

  // ── DRE ───────────────────────────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(12).text('DEMONSTRATIVO DE RESULTADO', 50, y)
  y += 20

  row('Receita Bruta', fmt(fechamento.receitaBruta), true)
  row('(-) Repasse Êxito', `(${fmt(fechamento.repasseExito)})`, false, 15)
  row('(-) Impostos', `(${fmt(fechamento.impostos)})`, false, 15)
  sep()
  row(`Receita Líquida`, fmt(fechamento.receitaLiquida), true)
  row('(-) Custos Diretos', `(${fmt(fechamento.custosDiretos)})`, false, 15)
  sep()
  row(`Margem de Contribuição (${fmtPct(fechamento.percMargem)})`, fmt(fechamento.margemContribuicao), true)

  y += 6
  doc.font('Helvetica-Oblique').fontSize(9).text('Despesas ADM:', 50, y)
  y += 15
  row('Pessoal', fmt(fechamento.despesasPessoal), false, 15)
  row('Marketing', fmt(fechamento.despesasMarketing), false, 15)
  row('Gerais', fmt(fechamento.despesasGerais), false, 15)
  sep()
  row(`Lucro Operacional (${fmtPct(fechamento.percLucroOp)})`, fmt(fechamento.lucroOperacional), true)
  row('(-) Retirada Sócios', `(${fmt(fechamento.retiradaSocios)})`, false, 15)
  row('Resultado Financeiro', fmt(fechamento.resultadoFinanceiro), false, 15)
  sep()
  row(`LUCRO LÍQUIDO (${fmtPct(fechamento.percLucroLiq)})`, fmt(fechamento.lucroLiquido), true)

  // ── Comparativo ───────────────────────────────────────────────────────────
  if (anterior) {
    y += 20
    doc.font('Helvetica-Bold').fontSize(12).text('COMPARATIVO COM MÊS ANTERIOR', 50, y)
    y += 20

    const delta = (atual: any, ant: any) => {
      const d = Number(atual || 0) - Number(ant || 0)
      return d >= 0 ? `▲ R$ ${fmt(d)}` : `▼ R$ ${fmt(Math.abs(d))}`
    }

    doc.font('Helvetica').fontSize(10)
    const rows2 = [
      ['Receita Bruta', fmt(anterior.receitaBruta), fmt(fechamento.receitaBruta), delta(fechamento.receitaBruta, anterior.receitaBruta)],
      ['Lucro Líquido', fmt(anterior.lucroLiquido), fmt(fechamento.lucroLiquido), delta(fechamento.lucroLiquido, anterior.lucroLiquido)],
    ]
    doc.text('Indicador', 50, y, { width: 180 })
    doc.text(`${MESES_PT[mesAnt]}`, 230, y, { width: 100, align: 'right' })
    doc.text(`${MESES_PT[mes]}`, 330, y, { width: 100, align: 'right' })
    doc.text('Variação', 430, y, { width: 115, align: 'right' })
    y += 15
    doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).stroke()
    y += 8

    for (const [label, ant, atual, var_] of rows2) {
      doc.font('Helvetica').fontSize(10)
      doc.text(label, 50, y, { width: 180 })
      doc.text(`R$ ${ant}`, 230, y, { width: 100, align: 'right' })
      doc.text(`R$ ${atual}`, 330, y, { width: 100, align: 'right' })
      const isPos = var_.startsWith('▲')
      doc.fillColor(isPos ? '#16a34a' : '#dc2626').text(var_, 430, y, { width: 115, align: 'right' })
      doc.fillColor('#000000')
      y += 18
    }
  }

  // ── Maiores despesas ──────────────────────────────────────────────────────
  if (maioresDespesas.length > 0) {
    y += 20
    doc.font('Helvetica-Bold').fontSize(12).text('MAIORES DESPESAS DO PERÍODO', 50, y)
    y += 20

    for (const d of maioresDespesas) {
      doc.font('Helvetica').fontSize(10)
      doc.text(d.favorecido || d.planoConta || 'Despesa', 50, y, { width: 350 })
      doc.text(`R$ ${fmt(Math.abs(Number(d.valor)))}`, 400, y, { width: 145, align: 'right' })
      y += 16
    }
  }

  // ── Rodapé ────────────────────────────────────────────────────────────────
  doc.fontSize(8).fillColor('#888888')
    .text(
      `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} | Radar Financeiro`,
      50, 780, { align: 'center', width: 495 }
    )

  doc.end()

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

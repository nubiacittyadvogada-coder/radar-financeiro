import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib'
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

  // ── Criar documento ──────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage(PageSizes.A4)
  const { width, height } = page.getSize()

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontReg  = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const nomeEmpresa = fechamento.contaEmpresa.nomeEmpresa || 'Empresa'

  const black  = rgb(0, 0, 0)
  const gray   = rgb(0.5, 0.5, 0.5)
  const green  = rgb(0.09, 0.64, 0.16)
  const red    = rgb(0.86, 0.15, 0.15)
  const blue   = rgb(0.11, 0.44, 0.80)

  let y = height - 50

  // ── Helpers ──────────────────────────────────────────────────────────────
  const text = (t: string, x: number, yPos: number, opts: {
    font?: typeof fontBold,
    size?: number,
    color?: ReturnType<typeof rgb>,
    align?: 'left' | 'right',
    maxWidth?: number,
  } = {}) => {
    const f = opts.font ?? fontReg
    const s = opts.size ?? 10
    const c = opts.color ?? black
    let drawX = x
    if (opts.align === 'right' && opts.maxWidth) {
      const tw = f.widthOfTextAtSize(t, s)
      drawX = x + opts.maxWidth - tw
    }
    page.drawText(t, { x: drawX, y: yPos, font: f, size: s, color: c })
  }

  const hLine = (yPos: number) => {
    page.drawLine({ start: { x: 50, y: yPos }, end: { x: width - 50, y: yPos }, thickness: 0.5, color: gray })
  }

  const row = (label: string, value: string, bold = false, indent = 0, valueColor?: ReturnType<typeof rgb>) => {
    const f = bold ? fontBold : fontReg
    text(label, 50 + indent, y, { font: f, size: 10 })
    text(`R$ ${value}`, 355, y, { font: f, size: 10, color: valueColor ?? black, align: 'right', maxWidth: 190 })
    y -= 18
  }

  const sep = () => {
    y -= 4
    hLine(y)
    y -= 10
  }

  // ── Cabeçalho ────────────────────────────────────────────────────────────
  text('Radar Financeiro', 50, y, { font: fontBold, size: 20, color: blue })
  y -= 25
  text(`Relatório Mensal — ${nomeEmpresa}`, 50, y, { font: fontReg, size: 12 })
  y -= 18
  text(`${MESES_PT[mes]} de ${ano}`, 50, y, { font: fontBold, size: 14 })
  y -= 15
  hLine(y)
  y -= 18

  // ── DRE ──────────────────────────────────────────────────────────────────
  text('DEMONSTRATIVO DE RESULTADO', 50, y, { font: fontBold, size: 12 })
  y -= 20

  const recBruta = Number(fechamento.receitaBruta || 0)
  const lucroLiq = Number(fechamento.lucroLiquido || 0)

  row('Receita Bruta', fmt(fechamento.receitaBruta), true, 0,
    recBruta >= 0 ? green : red)
  row('(-) Repasse Êxito', `(${fmt(fechamento.repasseExito)})`, false, 15)
  row('(-) Impostos', `(${fmt(fechamento.impostos)})`, false, 15)
  sep()
  row('Receita Líquida', fmt(fechamento.receitaLiquida), true)
  row('(-) Custos Diretos', `(${fmt(fechamento.custosDiretos)})`, false, 15)
  sep()
  row(`Margem de Contribuição (${fmtPct(fechamento.percMargem)})`, fmt(fechamento.margemContribuicao), true)

  y -= 4
  text('Despesas ADM:', 50, y, { font: fontReg, size: 9, color: gray })
  y -= 16
  row('Pessoal',    fmt(fechamento.despesasPessoal),  false, 15)
  row('Marketing',  fmt(fechamento.despesasMarketing), false, 15)
  row('Gerais',     fmt(fechamento.despesasGerais),    false, 15)
  sep()
  row(`Lucro Operacional (${fmtPct(fechamento.percLucroOp)})`, fmt(fechamento.lucroOperacional), true)
  row('(-) Retirada Sócios', `(${fmt(fechamento.retiradaSocios)})`, false, 15)
  row('Resultado Financeiro', fmt(fechamento.resultadoFinanceiro), false, 15)
  sep()
  row(
    `LUCRO LÍQUIDO (${fmtPct(fechamento.percLucroLiq)})`,
    fmt(fechamento.lucroLiquido),
    true, 0,
    lucroLiq >= 0 ? green : red
  )

  // ── Comparativo ──────────────────────────────────────────────────────────
  if (anterior) {
    y -= 16
    text('COMPARATIVO COM MÊS ANTERIOR', 50, y, { font: fontBold, size: 12 })
    y -= 18

    // Cabeçalho da tabela
    text('Indicador',        50,  y, { font: fontBold, size: 9 })
    text(MESES_PT[mesAnt],  270,  y, { font: fontBold, size: 9, align: 'right', maxWidth: 90 })
    text(MESES_PT[mes],     360,  y, { font: fontBold, size: 9, align: 'right', maxWidth: 90 })
    text('Variação',        450,  y, { font: fontBold, size: 9, align: 'right', maxWidth: 95 })
    y -= 12
    hLine(y)
    y -= 10

    const compRows = [
      ['Receita Bruta',   fechamento.receitaBruta,   anterior.receitaBruta],
      ['Receita Líquida', fechamento.receitaLiquida,  anterior.receitaLiquida],
      ['Lucro Líquido',   fechamento.lucroLiquido,    anterior.lucroLiquido],
    ]

    for (const [label, atual, ant] of compRows) {
      const d = Number(atual || 0) - Number(ant || 0)
      const varStr = d >= 0 ? `+R$ ${fmt(d)}` : `-R$ ${fmt(Math.abs(d))}`
      text(String(label),      50,  y, { size: 9 })
      text(`R$ ${fmt(ant)}`,  270,  y, { size: 9, align: 'right', maxWidth: 90 })
      text(`R$ ${fmt(atual)}`,360,  y, { size: 9, align: 'right', maxWidth: 90 })
      text(varStr,            450,  y, { size: 9, color: d >= 0 ? green : red, align: 'right', maxWidth: 95 })
      y -= 16
    }
  }

  // ── Maiores despesas ─────────────────────────────────────────────────────
  if (maioresDespesas.length > 0) {
    y -= 10
    text('MAIORES DESPESAS DO PERÍODO', 50, y, { font: fontBold, size: 12 })
    y -= 18

    for (const d of maioresDespesas) {
      const label = d.favorecido || d.planoConta || 'Despesa'
      text(label, 50, y, { size: 10 })
      text(`R$ ${fmt(Math.abs(Number(d.valor)))}`, 355, y, { size: 10, color: red, align: 'right', maxWidth: 190 })
      y -= 16
    }
  }

  // ── Rodapé ───────────────────────────────────────────────────────────────
  const rodape = `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} | Radar Financeiro`
  const rodapeW = fontReg.widthOfTextAtSize(rodape, 8)
  page.drawText(rodape, {
    x: (width - rodapeW) / 2,
    y: 30,
    font: fontReg,
    size: 8,
    color: gray,
  })

  // ── Salvar ───────────────────────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

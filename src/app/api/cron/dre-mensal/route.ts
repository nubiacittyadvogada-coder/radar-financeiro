/**
 * Cron: roda no último dia do mês às 18h Brasília (21h UTC).
 * 1. Calcula DRE do mês que fechou
 * 2. Calcula total a receber, inadimplência e projeção próximo mês (CobrancaDevedor)
 * 3. Compara com mês anterior
 * 4. Claude analisa e gera insights
 * 5. Gera PDF com PDFKit e envia por WhatsApp via Z-API
 *
 * Vercel cron: "0 21 28-31 * *" (dias 28-31, 21h UTC — filtra último dia internamente)
 */

import { NextRequest } from 'next/server'
import { writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import prisma from '@/server/lib/db'
import { calcularFechamentoEmpresa } from '@/server/lib/calcularFechamentoEmpresa'
import { getZApiClient } from '@/lib/zapi'

export const maxDuration = 120

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function fmt(v: any) {
  return `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function pct(v: any) {
  return `${Number(v || 0).toFixed(1)}%`
}

function isUltimoDiaMes(): boolean {
  const hoje = new Date()
  const amanha = new Date(hoje)
  amanha.setDate(amanha.getDate() + 1)
  return amanha.getDate() === 1
}

// ─── Dados de cobrança (a receber, inadimplência, projeção) ───────────────────

async function calcularDadosCobranca(contaEmpresaId: string, mes: number, ano: number) {
  const hoje = new Date()
  hoje.setHours(23, 59, 59, 999)

  const inicioMes = new Date(ano, mes - 1, 1)
  const fimMes = new Date(ano, mes, 0, 23, 59, 59)

  // Total a receber: pendentes com vencimento no mês
  const aReceber = await prisma.cobrancaDevedor.aggregate({
    where: {
      clienteDevedor: { contaEmpresaId },
      status: 'pendente',
      vencimento: { gte: inicioMes, lte: fimMes },
    },
    _sum: { valor: true },
    _count: true,
  })

  // Inadimplência: vencidas e não pagas (vencimento <= hoje)
  const inadimplencia = await prisma.cobrancaDevedor.aggregate({
    where: {
      clienteDevedor: { contaEmpresaId },
      status: 'pendente',
      vencimento: { lt: hoje },
    },
    _sum: { valor: true },
    _count: true,
  })

  // Projeção próximo mês: cobranças pendentes com vencimento no próximo mês
  const proxMes = mes === 12 ? 1 : mes + 1
  const proxAno = mes === 12 ? ano + 1 : ano
  const inicioProx = new Date(proxAno, proxMes - 1, 1)
  const fimProx = new Date(proxAno, proxMes, 0, 23, 59, 59)

  const projecao = await prisma.cobrancaDevedor.aggregate({
    where: {
      clienteDevedor: { contaEmpresaId },
      status: 'pendente',
      vencimento: { gte: inicioProx, lte: fimProx },
    },
    _sum: { valor: true },
    _count: true,
  })

  return {
    aReceber: Number(aReceber._sum.valor || 0),
    qtdAReceber: aReceber._count,
    inadimplencia: Number(inadimplencia._sum.valor || 0),
    qtdInadimplentes: inadimplencia._count,
    projecaoProxMes: Number(projecao._sum.valor || 0),
    qtdProjecao: projecao._count,
  }
}

// ─── Geração de PDF ───────────────────────────────────────────────────────────

async function gerarPDF(
  empresa: string,
  mes: number,
  ano: number,
  dre: any,
  cobranca: ReturnType<typeof calcularDadosCobranca> extends Promise<infer T> ? T : never,
  anterior: any | null
): Promise<Buffer> {
  // Importação dinâmica para evitar problemas com SSR
  const PDFDocument = (await import('pdfkit')).default

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const d = (v: any) => Number(v || 0)

    // ── Cabeçalho ──────────────────────────────────────────────────────────
    doc.fontSize(18).font('Helvetica-Bold')
      .text(`RADAR FINANCEIRO`, { align: 'center' })
    doc.fontSize(13).font('Helvetica')
      .text(`${empresa}`, { align: 'center' })
    doc.fontSize(11)
      .text(`Fechamento Mensal — ${MESES[mes]}/${ano}`, { align: 'center' })
    doc.moveDown()

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.5)

    const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    doc.fontSize(9).fillColor('#666')
      .text(`Gerado em: ${geradoEm}`, { align: 'right' })
    doc.fillColor('#000')
    doc.moveDown()

    // ── Linha helper ───────────────────────────────────────────────────────
    const linha = (label: string, valor: number, bold = false, cor = '#000') => {
      const y = doc.y
      doc.fontSize(10)
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(cor)
        .text(label, 50, y, { continued: false, width: 350 })
        .text(fmt(valor), 400, y, { align: 'right', width: 145 })
      doc.fillColor('#000').font('Helvetica')
      doc.moveDown(0.3)
    }

    const separador = () => {
      doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.5).stroke()
      doc.moveDown(0.3)
    }

    const titulo = (t: string) => {
      doc.moveDown(0.3)
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a56db').text(t)
      doc.fillColor('#000').font('Helvetica')
      doc.moveDown(0.2)
    }

    // ── DRE ───────────────────────────────────────────────────────────────
    titulo('DEMONSTRATIVO DE RESULTADO (DRE)')

    linha('Receita Bruta', d(dre.receitaBruta), true)
    linha(`  Impostos`, -d(dre.impostos))
    linha(`  Repasses de Êxito`, -d(dre.repasseExito))
    linha('Receita Líquida', d(dre.receitaLiquida), true, d(dre.receitaLiquida) >= 0 ? '#166534' : '#991b1b')
    separador()

    linha('Custos Diretos', -d(dre.custosDiretos))
    linha('Margem de Contribuição', d(dre.margemContribuicao), true)
    separador()

    linha('Despesas de Pessoal', -d(dre.despesasPessoal))
    linha('Despesas de Marketing', -d(dre.despesasMarketing))
    linha('Despesas Gerais', -d(dre.despesasGerais))
    linha('Total Despesas ADM', -d(dre.totalDespesasAdm))
    separador()

    linha('Lucro Operacional', d(dre.lucroOperacional), true, d(dre.lucroOperacional) >= 0 ? '#166534' : '#991b1b')
    linha('Retirada de Sócios', -d(dre.retiradaSocios))
    linha('Resultado Financeiro', d(dre.resultadoFinanceiro))

    const lucro = d(dre.lucroLiquido)
    linha('LUCRO LÍQUIDO', lucro, true, lucro >= 0 ? '#166534' : '#991b1b')

    doc.fontSize(9).fillColor('#555')
      .text(`Margem Líquida: ${pct(dre.percLucroLiq)}   |   Margem Operacional: ${pct(dre.percLucroOp)}`)
    doc.fillColor('#000')
    doc.moveDown()

    // ── Cobranças ─────────────────────────────────────────────────────────
    titulo('COBRANÇAS E INADIMPLÊNCIA')

    linha(`A receber este mês (${cobranca.qtdAReceber} cobranças)`, cobranca.aReceber)
    linha(`Inadimplência (${cobranca.qtdInadimplentes} em atraso)`, cobranca.inadimplencia, false, '#991b1b')
    linha(`Projeção ${MESES[mes === 12 ? 1 : mes + 1]}/${mes === 12 ? ano + 1 : ano} (${cobranca.qtdProjecao} cobranças)`, cobranca.projecaoProxMes, true, '#1e40af')
    doc.moveDown()

    // ── Comparativo ───────────────────────────────────────────────────────
    if (anterior) {
      titulo('COMPARATIVO COM MÊS ANTERIOR')

      const mesAntNome = MESES[mes === 1 ? 12 : mes - 1]
      const varReceita = d(dre.receitaBruta) - d(anterior.receitaBruta)
      const varLucro = d(dre.lucroLiquido) - d(anterior.lucroLiquido)
      const varDesp = d(dre.totalDespesasAdm) - d(anterior.totalDespesasAdm)

      doc.fontSize(10).font('Helvetica')
      const seta = (v: number) => v >= 0 ? '▲' : '▼'
      const cor = (v: number) => v >= 0 ? '#166534' : '#991b1b'

      doc.fillColor(cor(varReceita))
        .text(`${seta(varReceita)} Receita: ${fmt(Math.abs(varReceita))} vs ${mesAntNome}`)
      doc.fillColor(cor(varLucro))
        .text(`${seta(varLucro)} Lucro líquido: ${fmt(Math.abs(varLucro))} vs ${mesAntNome}`)
      doc.fillColor(cor(-varDesp))
        .text(`${seta(-varDesp)} Despesas ADM: ${fmt(Math.abs(varDesp))} vs ${mesAntNome}`)
      doc.fillColor('#000')
      doc.moveDown()
    }

    // ── Rodapé ──────────────────────────────────────────────────────────
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.3)
    doc.fontSize(8).fillColor('#888')
      .text('Radar Financeiro — Relatório gerado automaticamente', { align: 'center' })

    doc.end()
  })
}

// ─── Análise IA ───────────────────────────────────────────────────────────────

async function gerarAnaliseIA(empresa: string, mes: number, ano: number, atual: any, anterior: any | null, cobranca: any): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return gerarAnaliseFallback(mes, ano, atual, anterior)

  const d = (v: any) => Number(v || 0)

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Analise o DRE de ${empresa} para ${MESES[mes]}/${ano} e gere um resumo executivo em 3-4 pontos para WhatsApp. Seja direto e prático. Use emoji. Máximo 200 palavras.

Receita Bruta: R$ ${d(atual.receitaBruta).toFixed(2)}
Lucro Líquido: R$ ${d(atual.lucroLiquido).toFixed(2)} (${pct(atual.percLucroLiq)})
Total Despesas: R$ ${d(atual.totalDespesasAdm).toFixed(2)}
Inadimplência: R$ ${cobranca.inadimplencia.toFixed(2)} (${cobranca.qtdInadimplentes} clientes)
${anterior ? `Receita anterior: R$ ${d(anterior.receitaBruta).toFixed(2)}` : ''}

Responda apenas com o texto da análise.`,
        }],
      }),
    })
    const data = await res.json()
    return data.content?.[0]?.text || gerarAnaliseFallback(mes, ano, atual, anterior)
  } catch {
    return gerarAnaliseFallback(mes, ano, atual, anterior)
  }
}

function gerarAnaliseFallback(mes: number, ano: number, atual: any, anterior: any | null): string {
  const d = (v: any) => Number(v || 0)
  const partes: string[] = []
  const lucro = d(atual.lucroLiquido)

  if (lucro > 0) {
    partes.push(`✅ Lucro líquido de ${fmt(lucro)} (margem ${pct(atual.percLucroLiq)})`)
  } else {
    partes.push(`⚠️ Resultado negativo de ${fmt(lucro)} — atenção às despesas`)
  }

  if (anterior) {
    const varReceita = d(atual.receitaBruta) - d(anterior.receitaBruta)
    partes.push(`${varReceita >= 0 ? '📈' : '📉'} Receita ${varReceita >= 0 ? '+' : ''}${fmt(varReceita)} vs ${MESES[mes === 1 ? 12 : mes - 1]}`)
  }

  return partes.join('\n')
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = authHeader?.replace('Bearer ', '') || req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return Response.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const forcar = req.nextUrl.searchParams.get('forcar') === '1'
  if (!forcar && !isUltimoDiaMes()) {
    return Response.json({ ok: true, pulado: true, motivo: 'Não é o último dia do mês' })
  }

  const agora = new Date()
  const mes = agora.getMonth() + 1
  const ano = agora.getFullYear()
  const mesAnt = mes === 1 ? 12 : mes - 1
  const anoAnt = mes === 1 ? ano - 1 : ano

  const resultados: Array<{ empresa: string; enviado: boolean; pdfEnviado: boolean }> = []

  try {
    const contas = await prisma.contaEmpresa.findMany({
      where: {
        alertaAtivo: true,
        telefoneAlerta: { not: null },
        zapiInstanceId: { not: null },
        zapiToken: { not: null },
        zapiClientToken: { not: null },
      },
    })

    for (const conta of contas) {
      let enviado = false
      let pdfEnviado = false

      try {
        // 1. Recalcula fechamento
        const fechamentoAtual = await calcularFechamentoEmpresa(conta.id, mes, ano)

        // 2. Busca fechamento anterior
        const fechamentoAnterior = await prisma.fechamentoEmpresa.findUnique({
          where: { contaEmpresaId_mes_ano: { contaEmpresaId: conta.id, mes: mesAnt, ano: anoAnt } },
        })

        // 3. Dados de cobrança
        const dadosCobranca = await calcularDadosCobranca(conta.id, mes, ano)

        // 4. Análise IA
        const analise = await gerarAnaliseIA(conta.nomeEmpresa, mes, ano, fechamentoAtual, fechamentoAnterior, dadosCobranca)

        // 5. Monta mensagem WhatsApp
        const d = (v: any) => Number(v || 0)
        const mensagem =
          `📊 *FECHAMENTO ${MESES[mes].toUpperCase()}/${ano}*\n` +
          `_${conta.nomeEmpresa}_\n\n` +
          `💰 Receita Bruta: *${fmt(fechamentoAtual.receitaBruta)}*\n` +
          `💵 Receita Líquida: *${fmt(fechamentoAtual.receitaLiquida)}*\n` +
          `─────────────────\n` +
          `👥 Pessoal: ${fmt(fechamentoAtual.despesasPessoal)}\n` +
          `🗂️ Gerais: ${fmt(fechamentoAtual.despesasGerais)}\n` +
          `─────────────────\n` +
          `📈 Resultado: *${fmt(fechamentoAtual.lucroLiquido)}* (${pct(fechamentoAtual.percLucroLiq)})\n` +
          `─────────────────\n` +
          `📩 A receber: ${fmt(dadosCobranca.aReceber)}\n` +
          `⚠️ Inadimplência: ${fmt(dadosCobranca.inadimplencia)} (${dadosCobranca.qtdInadimplentes} clientes)\n` +
          `🔮 Projeção ${MESES[mes === 12 ? 1 : mes + 1]}: ${fmt(dadosCobranca.projecaoProxMes)}\n\n` +
          `🤖 *Análise:*\n${analise}\n\n` +
          `_PDF completo em anexo_`

        // 6. Envia mensagem de texto
        const zapi = getZApiClient(conta)
        if (zapi && conta.telefoneAlerta) {
          enviado = await zapi.enviarTexto(conta.telefoneAlerta, mensagem)
        }

        // 7. Gera e envia PDF
        if (zapi && conta.telefoneAlerta) {
          try {
            const pdfBuffer = await gerarPDF(
              conta.nomeEmpresa,
              mes,
              ano,
              fechamentoAtual,
              dadosCobranca,
              fechamentoAnterior
            )
            const base64 = pdfBuffer.toString('base64')
            const nomeArquivo = `FINANCEIRO_${MESES[mes].toUpperCase()}_${ano}.pdf`
            pdfEnviado = await zapi.enviarDocumento(
              conta.telefoneAlerta,
              base64,
              nomeArquivo,
              `📊 Fechamento ${MESES[mes]}/${ano} — ${conta.nomeEmpresa}`
            )
          } catch (pdfErr: any) {
            console.error(`[Cron DRE] Erro ao gerar/enviar PDF para ${conta.nomeEmpresa}:`, pdfErr.message)
          }
        }

        resultados.push({ empresa: conta.nomeEmpresa, enviado, pdfEnviado })

        // 8. Salva log no histórico IA
        await prisma.conversaIAEmpresa.create({
          data: {
            contaEmpresaId: conta.id,
            pergunta: `DRE automático ${MESES[mes]}/${ano}`,
            resposta: analise,
            contextoMes: mes,
            contextoAno: ano,
          },
        })
      } catch (err: any) {
        console.error(`[Cron DRE] Erro em ${conta.nomeEmpresa}:`, err.message)
        resultados.push({ empresa: conta.nomeEmpresa, enviado: false, pdfEnviado: false })
      }
    }

    return Response.json({ ok: true, mes, ano, processados: contas.length, resultados })
  } catch (err: any) {
    console.error('[Cron dre-mensal]', err.message)
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

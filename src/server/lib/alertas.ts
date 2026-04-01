import prisma from './db'

interface RegrasAlerta {
  id: string
  condicao: (f: any, anterior?: any) => boolean
  titulo: string
  mensagem: (f: any, anterior?: any) => string
}

const MESES = [
  '', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const fmt = (v: number) =>
  Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const REGRAS: RegrasAlerta[] = [
  {
    id: 'caixa_risco',
    condicao: (f) => f.saldoFinal !== null && Number(f.saldoFinal) < 0,
    titulo: 'Caixa em zona de risco',
    mensagem: (f) =>
      `Seu caixa fechou o mês negativo em R$ ${fmt(Number(f.saldoFinal))}. É necessário ação imediata.`,
  },
  {
    id: 'retirada_acima_lucro',
    condicao: (f) =>
      Number(f.retiradaSocios) > Number(f.lucroOperacional) * 1.2 &&
      Number(f.retiradaSocios) > 0,
    titulo: 'Retirada acima do lucro',
    mensagem: (f) =>
      `Você retirou R$ ${fmt(Number(f.retiradaSocios))} mas o lucro operacional foi R$ ${fmt(Number(f.lucroOperacional))}. Isso pressiona o caixa do próximo mês.`,
  },
  {
    id: 'margem_baixa',
    condicao: (f) => Number(f.percMargem) < 50 && Number(f.receitaBruta) > 0,
    titulo: 'Margem de contribuição abaixo de 50%',
    mensagem: (f) =>
      `Sua margem foi de ${Number(f.percMargem).toFixed(1)}% este mês. Custos diretos estão consumindo mais do que o esperado.`,
  },
  {
    id: 'despesa_crescimento',
    condicao: (f, ant) =>
      ant &&
      Number(ant.totalDespesasAdm) > 0 &&
      Number(f.totalDespesasAdm) > Number(ant.totalDespesasAdm) * 1.3,
    titulo: 'Despesas cresceram mais de 30%',
    mensagem: (f, ant) =>
      `Suas despesas passaram de R$ ${fmt(Number(ant.totalDespesasAdm))} para R$ ${fmt(Number(f.totalDespesasAdm))} — alta de ${(((Number(f.totalDespesasAdm) - Number(ant.totalDespesasAdm)) / Number(ant.totalDespesasAdm)) * 100).toFixed(0)}%. Vale revisar o que cresceu.`,
  },
  {
    id: 'prejuizo_liquido',
    condicao: (f) => Number(f.lucroLiquido) < 0,
    titulo: 'Mês encerrado no prejuízo',
    mensagem: (f) =>
      `O resultado líquido de ${MESES[f.mes]}/${f.ano} foi negativo: R$ ${fmt(Number(f.lucroLiquido))}.`,
  },
]

/**
 * Verifica regras de alerta para um fechamento e cria registros.
 */
export async function verificarAlertas(
  clienteId: string,
  mes: number,
  ano: number
): Promise<void> {
  const fechamento = await prisma.fechamento.findUnique({
    where: { clienteId_mes_ano: { clienteId, mes, ano } },
  })

  if (!fechamento) return

  // Buscar fechamento anterior
  const mesAnt = mes === 1 ? 12 : mes - 1
  const anoAnt = mes === 1 ? ano - 1 : ano
  const anterior = await prisma.fechamento.findUnique({
    where: { clienteId_mes_ano: { clienteId, mes: mesAnt, ano: anoAnt } },
  })

  for (const regra of REGRAS) {
    try {
      if (regra.condicao(fechamento, anterior)) {
        // Verifica se já existe alerta deste tipo para este período
        const existe = await prisma.alerta.findFirst({
          where: {
            clienteId,
            tipo: regra.id,
            criadoEm: {
              gte: new Date(ano, mes - 1, 1),
              lt: new Date(ano, mes, 1),
            },
          },
        })

        if (!existe) {
          await prisma.alerta.create({
            data: {
              clienteId,
              tipo: regra.id,
              titulo: regra.titulo,
              mensagem: regra.mensagem(fechamento, anterior),
              canal: 'whatsapp',
            },
          })
        }
      }
    } catch {
      // Regra falhou (ex: anterior null em regra que precisa), ignora
    }
  }
}

/**
 * Envia alertas pendentes via WhatsApp (Z-API).
 */
export async function enviarAlertasWhatsApp(): Promise<void> {
  const alertasPendentes = await prisma.alerta.findMany({
    where: { enviado: false, canal: 'whatsapp' },
    include: {
      cliente: {
        select: { alertaWpp: true, telefoneWpp: true, nomeEmpresa: true },
      },
    },
  })

  for (const alerta of alertasPendentes) {
    if (!alerta.cliente.alertaWpp || !alerta.cliente.telefoneWpp) {
      continue
    }

    try {
      const instanceId = process.env.ZAPI_INSTANCE_ID
      const token = process.env.ZAPI_TOKEN

      if (!instanceId || !token) {
        console.warn('[Alertas] Z-API não configurada, pulando envio')
        continue
      }

      const mensagem = `*Radar Financeiro — ${alerta.titulo}*\n\n${alerta.mensagem}\n\n_${alerta.cliente.nomeEmpresa}_`

      const response = await fetch(
        `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': process.env.ZAPI_CLIENT_TOKEN || '' },
          body: JSON.stringify({
            phone: alerta.cliente.telefoneWpp.replace(/\D/g, ''),
            message: mensagem,
          }),
        }
      )

      if (response.ok) {
        await prisma.alerta.update({
          where: { id: alerta.id },
          data: { enviado: true, enviadoEm: new Date() },
        })
      } else {
        const errBody = await response.text()
        await prisma.alerta.update({
          where: { id: alerta.id },
          data: { erro: `HTTP ${response.status}: ${errBody}` },
        })
      }
    } catch (err: any) {
      await prisma.alerta.update({
        where: { id: alerta.id },
        data: { erro: err.message },
      })
    }
  }
}

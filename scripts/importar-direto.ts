import 'dotenv/config'
import * as XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import { classificar, normalizarStatusPg, parseValor, excelDateToJs } from '../src/server/lib/classificador'
import { calcularFechamento } from '../src/server/lib/calcularFechamento'
import path from 'path'
import fs from 'fs'

const prisma = new PrismaClient()
const CID = '20b75982-08df-4e40-a662-d87389374495'
const downloadsDir = path.join(process.env.USERPROFILE!, 'Downloads')

async function importarReceitas() {
  const buffer = fs.readFileSync(path.join(downloadsDir, 'Receitas - NC.xlsx'))
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  const imp = await prisma.importacao.create({
    data: { clienteId: CID, tipo: 'receitas', nomeArquivo: 'Receitas - NC.xlsx', mes: 3, ano: 2026, status: 'processando' }
  })

  const lancamentos: any[] = []
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    const planoConta = String(row[1] || '').trim()
    if (!planoConta) continue
    try {
      const { tipo, subtipo, grupoConta } = classificar(planoConta)
      const valor = parseValor(row[6])
      const { statusPg, previsto } = normalizarStatusPg(String(row[8] || ''), undefined, 'receitas')
      const dataReceb = excelDateToJs(row[9])
      const dataVenda = excelDateToJs(row[5]) || excelDateToJs(row[7])
      const dataRef = previsto ? dataVenda : (dataReceb || dataVenda)
      const linhaM = dataRef ? dataRef.getMonth() + 1 : 3
      const linhaA = dataRef ? dataRef.getFullYear() : 2026
      lancamentos.push({
        importacaoId: imp.id, clienteId: CID, mes: linhaM, ano: linhaA,
        planoConta, grupoConta,
        area: String(row[2] || '').trim() || null,
        advogado: String(row[3] || '').trim() || null,
        descricao: String(row[4] || '').trim() || null,
        dataCompetencia: excelDateToJs(row[5]),
        valor, dataVencimento: excelDateToJs(row[7]),
        statusPg, dataPagamento: dataReceb,
        formaPagamento: String(row[11] || '').trim() || null,
        banco: String(row[10] || '').trim() || null,
        conciliado: String(row[12] || '').toUpperCase().includes('CONCILIADO'),
        tipo, subtipo, previsto,
      })
    } catch (e) {}
  }

  await prisma.lancamento.createMany({ data: lancamentos })
  await prisma.importacao.update({ where: { id: imp.id }, data: { status: 'concluido', totalLinhas: data.length - 1, linhasProcessadas: lancamentos.length } })
  console.log('✓ Receitas:', lancamentos.length, 'lançamentos')
}

async function importarDespesas() {
  const buffer = fs.readFileSync(path.join(downloadsDir, 'Despesas - NC.xlsx'))
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  const imp = await prisma.importacao.create({
    data: { clienteId: CID, tipo: 'despesas', nomeArquivo: 'Despesas - NC.xlsx', mes: 3, ano: 2026, status: 'processando' }
  })

  const lancamentos: any[] = []
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    const planoConta = String(row[1] || '').trim()
    if (!planoConta) continue
    try {
      const { tipo, subtipo, grupoConta } = classificar(planoConta)
      const valor = parseValor(row[6])
      const { statusPg, previsto } = normalizarStatusPg(String(row[8] || ''), String(row[9] || ''), 'despesas')
      const dataPg = excelDateToJs(row[10])
      const dataComp = excelDateToJs(row[5]) || excelDateToJs(row[7])
      const dataRef = previsto ? dataComp : (dataPg || dataComp)
      const linhaM = dataRef ? dataRef.getMonth() + 1 : 3
      const linhaA = dataRef ? dataRef.getFullYear() : 2026
      lancamentos.push({
        importacaoId: imp.id, clienteId: CID, mes: linhaM, ano: linhaA,
        planoConta, grupoConta,
        area: String(row[2] || '').trim() || null,
        descricao: String(row[3] || '').trim() || null,
        dataCompetencia: excelDateToJs(row[5]),
        valor, dataVencimento: excelDateToJs(row[7]),
        statusPg, dataPagamento: dataPg,
        formaPagamento: String(row[11] || '').trim() || null,
        banco: String(row[12] || '').trim() || null,
        conciliado: String(row[13] || '').toUpperCase().includes('CONCILIADO'),
        tipo, subtipo, previsto,
      })
    } catch (e) {}
  }

  await prisma.lancamento.createMany({ data: lancamentos })
  await prisma.importacao.update({ where: { id: imp.id }, data: { status: 'concluido', totalLinhas: data.length - 1, linhasProcessadas: lancamentos.length } })
  console.log('✓ Despesas:', lancamentos.length, 'lançamentos')
}

async function main() {
  console.log('Importando...')
  await importarReceitas()
  await importarDespesas()

  const meses = await prisma.lancamento.findMany({
    where: { clienteId: CID },
    select: { mes: true, ano: true },
    distinct: ['mes', 'ano'],
    orderBy: [{ ano: 'asc' }, { mes: 'asc' }]
  })
  console.log('Meses encontrados:', meses.map(m => m.mes + '/' + m.ano).join(', '))

  for (const { mes, ano } of meses) {
    await calcularFechamento(CID, mes, ano)
    process.stdout.write('.')
  }
  console.log('\n✓ Fechamentos calculados!')

  // Mostrar resumo
  const fechamentos = await prisma.fechamento.findMany({
    where: { clienteId: CID },
    orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
    select: { mes: true, ano: true, receitaBruta: true, lucroOperacional: true, lucroLiquido: true }
  })
  const fmt = (v: any) => 'R$' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  fechamentos.forEach(f => {
    console.log(String(f.mes).padStart(2, '0') + '/' + f.ano, '| Rec:', fmt(f.receitaBruta), '| LucOp:', fmt(f.lucroOperacional), '| LucLiq:', fmt(f.lucroLiquido))
  })

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

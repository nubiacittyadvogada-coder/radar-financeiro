'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { MESES, formatarMoeda } from '@/lib/utils'

function excelSerial(v: any): string | null {
  if (typeof v === 'number' && v > 40000) {
    const d = new Date((v - 25569) * 86400 * 1000)
    return d.toISOString().slice(0, 10)
  }
  if (typeof v === 'string' && v.match(/\d{2}\/\d{2}\/\d{4}/)) {
    const [d, m, y] = v.split('/')
    return `${y}-${m}-${d}`
  }
  return null
}

function parseMoeda(v: any): number {
  if (typeof v === 'number') return Math.abs(v)
  const s = String(v).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
  return Math.abs(parseFloat(s) || 0)
}

type ResumoMes = { mes: number; ano: number; total: number; tipo: string }
type PreviewImport = { resumo: ResumoMes[]; totalLinhas: number; lancamentos: any[] }

export default function EmpresaImportarPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [preview, setPreview] = useState<PreviewImport | null>(null)
  const [tipoImport, setTipoImport] = useState<'receitas' | 'despesas' | 'contas' | 'pdf' | null>(null)
  const [importando, setImportando] = useState(false)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [previewPdf, setPreviewPdf] = useState<any | null>(null)
  const [confirmandoPdf, setConfirmandoPdf] = useState(false)

  const receitasRef = useRef<HTMLInputElement>(null)
  const despesasRef = useRef<HTMLInputElement>(null)
  const contasRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
  }, [router])

  // ─── RECEITAS ──────────────────────────────────────────────────────────────
  async function processarReceitas(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setErro(''); setSucesso(null); setPreview(null); setLoading(true); setTipoImport('receitas')

    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })

      // Acha aba Receitas
      const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('receita')) || wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      // Header
      let hi = -1; let cm: Record<string, number> = {}
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const r = rows[i].map((c: any) => String(c).toUpperCase())
        if (r.some(c => c.includes('FAVORECIDO') || c.includes('P.CONTA'))) {
          hi = i
          r.forEach((c, idx) => {
            if (c.includes('FAVORECIDO')) cm.favorecido = idx
            if (c.includes('P.CONTA') || c.includes('PLANO')) cm.planoConta = idx
            if (c.includes('AREA') || c.includes('ÁREA')) cm.area = idx
            if (c.includes('ADVOGADO')) cm.advogado = idx
            if (c.includes('DESCRICAO') || c.includes('DESCRIÇÃO')) cm.descricao = idx
            if (c === 'VALOR') cm.valor = idx
            if (c.includes('DATA VENC') || (c.includes('VENC') && !c.includes('RECEB'))) cm.dataVenc = idx
            if (c.includes('DATA RECEB') || c.includes('RECEB')) cm.dataReceb = idx
            if (c === 'PG') cm.pg = idx
            if (c.includes('BANCO')) cm.banco = idx
            if (c.includes('FORMA')) cm.forma = idx
            if (c.includes('DATA VENDA')) cm.dataVenda = idx
          })
          break
        }
      }
      if (hi === -1) throw new Error('Cabeçalho não encontrado. Esperado: FAVORECIDO, P.CONTAS, VALOR')

      const lancamentos: any[] = []
      for (let i = hi + 1; i < rows.length; i++) {
        const row = rows[i]
        const planoConta = String(row[cm.planoConta] || '').trim()
        if (!planoConta || planoConta.length < 4) continue
        const valor = parseMoeda(row[cm.valor])
        if (valor === 0) continue

        // Data de competência = data de vencimento ou data de venda
        const dataVencRaw = row[cm.dataVenc]
        const dataVendaRaw = row[cm.dataVenda]
        const dataCompetencia = excelSerial(dataVencRaw) || excelSerial(dataVendaRaw)
        if (!dataCompetencia) continue

        const d = new Date(dataCompetencia)
        const mes = d.getUTCMonth() + 1
        const ano = d.getUTCFullYear()

        const pg = String(row[cm.pg] || '').toUpperCase().trim()
        const recebida = pg === 'PG'

        lancamentos.push({
          favorecido: String(row[cm.favorecido] || '').trim() || null,
          planoConta,
          area: String(row[cm.area] || '').trim() || null,
          advogado: String(row[cm.advogado] || '').trim() || null,
          descricao: String(row[cm.descricao] || '').trim() || null,
          dataCompetencia,
          valor,
          statusPg: pg,
          previsto: !recebida,
          mes,
          ano,
          banco: String(row[cm.banco] || '').trim() || null,
          formaPagamento: String(row[cm.forma] || '').trim() || null,
        })
      }

      if (lancamentos.length === 0) throw new Error('Nenhuma receita encontrada na planilha')
      gerarPreview(lancamentos, 'receitas')
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setLoading(false)
      if (receitasRef.current) receitasRef.current.value = ''
    }
  }

  // ─── DESPESAS ──────────────────────────────────────────────────────────────
  async function processarDespesas(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setErro(''); setSucesso(null); setPreview(null); setLoading(true); setTipoImport('despesas')

    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })

      const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('despesa')) || wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      let hi = -1; let cm: Record<string, number> = {}
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const r = rows[i].map((c: any) => String(c).toUpperCase())
        if (r.some(c => c.includes('FAVORECIDO') || c.includes('P.CONTA'))) {
          hi = i
          r.forEach((c, idx) => {
            if (c.includes('FAVORECIDO')) cm.favorecido = idx
            if (c.includes('P.CONTA') || c.includes('PLANO')) cm.planoConta = idx
            if (c.includes('AREA') || c.includes('ÁREA')) cm.area = idx
            if (c.includes('DESCRICAO') || c.includes('DESCRIÇÃO')) cm.descricao = idx
            if (c.includes('COMPETENCIA') || c.includes('COMPETÊNCIA')) cm.dataComp = idx
            if (c === 'VALOR') cm.valor = idx
            if (c.includes('VENCIMENTO')) cm.dataVenc = idx
            if (c === 'SIT.' || c === 'STATUS') cm.sit = idx
            if (c === 'PG') cm.pg = idx
            if (c.includes('DATA PAGAMENTO')) cm.dataPag = idx
            if (c.includes('FORMA')) cm.forma = idx
            if (c.includes('BANCO')) cm.banco = idx
          })
          break
        }
      }
      if (hi === -1) throw new Error('Cabeçalho não encontrado. Esperado: FAVORECIDO, P.CONTAS, VALOR')

      const lancamentos: any[] = []
      for (let i = hi + 1; i < rows.length; i++) {
        const row = rows[i]
        const planoConta = String(row[cm.planoConta] || '').trim()
        if (!planoConta || planoConta.length < 4) continue
        const valor = parseMoeda(row[cm.valor])
        if (valor === 0) continue

        const dataCompRaw = row[cm.dataComp]
        const dataVencRaw = row[cm.dataVenc]
        const dataCompetencia = excelSerial(dataCompRaw) || excelSerial(dataVencRaw)
        if (!dataCompetencia) continue

        const d = new Date(dataCompetencia)
        const mes = d.getUTCMonth() + 1
        const ano = d.getUTCFullYear()

        const pg = String(row[cm.pg] || '').toUpperCase().trim()
        const sit = String(row[cm.sit] || '').toUpperCase().trim()
        // Previsto = não está pago E SIT é diferente de OK
        const previsto = pg !== 'PG' && sit !== 'OK'

        lancamentos.push({
          favorecido: String(row[cm.favorecido] || '').trim() || null,
          planoConta,
          area: String(row[cm.area] || '').trim() || null,
          descricao: String(row[cm.descricao] || '').trim() || null,
          dataCompetencia,
          valor,
          statusPg: pg || sit,
          previsto,
          mes,
          ano,
          formaPagamento: String(row[cm.forma] || '').trim() || null,
          banco: String(row[cm.banco] || '').trim() || null,
        })
      }

      if (lancamentos.length === 0) throw new Error('Nenhuma despesa encontrada na planilha')
      gerarPreview(lancamentos, 'despesas')
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setLoading(false)
      if (despesasRef.current) despesasRef.current.value = ''
    }
  }

  // ─── CONTAS A PAGAR ─────────────────────────────────────────────────────────
  async function processarContas(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setErro(''); setSucesso(null); setPreview(null); setLoading(true); setTipoImport('contas')

    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })

      const sheetName = wb.SheetNames.find(n =>
        n.toLowerCase().includes('relatório') || n.toLowerCase().includes('relatorio') || n.toLowerCase().includes('contas')
      ) || wb.SheetNames[0]

      const ws = wb.Sheets[sheetName]
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      let hi = -1; let cm: Record<string, number> = {}
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const r = rows[i].map((c: any) => String(c).toUpperCase())
        if (r.some(c => c.includes('FAVORECIDO'))) {
          hi = i
          r.forEach((c, idx) => {
            if (c.includes('FAVORECIDO')) cm.favorecido = idx
            if (c.includes('PLANO') || c.includes('P.CONTA')) cm.planoConta = idx
            if (c.includes('AREA') || c.includes('ÁREA')) cm.area = idx
            if (c.includes('DESCRICAO') || c.includes('DESCRIÇÃO')) cm.descricao = idx
            if (c === 'VALOR') cm.valor = idx
            if (c.includes('VENC') && !c.includes('VENCER')) cm.vencimento = idx
            if (c === 'STATUS') cm.status = idx
            if (c === 'PG') cm.pg = idx
          })
          break
        }
      }
      if (hi === -1) throw new Error('Cabeçalho não encontrado')

      const contas: any[] = []
      for (let i = hi + 1; i < rows.length; i++) {
        const row = rows[i]
        const pg = String(row[cm.pg] || '').toUpperCase().trim()
        if (pg === 'PG') continue // Ignora já pagas

        const vencRaw = row[cm.vencimento]
        const vencimento = excelSerial(vencRaw)
        if (!vencimento) continue

        const valor = parseMoeda(row[cm.valor])
        if (valor === 0) continue

        const favorecido = String(row[cm.favorecido] || '').trim()
        const descricao = String(row[cm.descricao] || favorecido || '').trim()
        if (!descricao) continue

        contas.push({
          descricao,
          fornecedor: favorecido || null,
          valor,
          vencimento,
          categoria: String(row[cm.planoConta] || '').trim() || 'outros',
          status: 'pendente',
        })
      }

      if (contas.length === 0) throw new Error('Nenhuma conta pendente encontrada (contas PG foram ignoradas)')

      // Mostra preview agrupado por mês
      const por_mes: Record<string, number> = {}
      contas.forEach(c => {
        const k = c.vencimento.slice(0, 7)
        por_mes[k] = (por_mes[k] || 0) + c.valor
      })

      const resumo = Object.entries(por_mes).map(([k, total]) => {
        const [ano, mes] = k.split('-').map(Number)
        return { mes, ano, total, tipo: 'contas' }
      }).sort((a, b) => a.ano - b.ano || a.mes - b.mes)

      setPreview({ resumo, totalLinhas: contas.length, lancamentos: contas })
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setLoading(false)
      if (contasRef.current) contasRef.current.value = ''
    }
  }

  async function processarPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setErro(''); setSucesso(null); setPreviewPdf(null); setLoading(true); setTipoImport('pdf')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/v2/empresa/importar-pdf', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setPreviewPdf(data)
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setLoading(false)
      if (pdfRef.current) pdfRef.current.value = ''
    }
  }

  async function confirmarPdf() {
    if (!previewPdf || !token) return
    setConfirmandoPdf(true)
    setErro('')
    try {
      const CATS_RECEITA: Record<string, { tipo: string; planoConta: string }> = {
        honorario_inicial: { tipo: 'receita', planoConta: 'Honorários Iniciais' },
        honorario_mensal: { tipo: 'receita', planoConta: 'Honorários Mensais' },
        consulta: { tipo: 'receita', planoConta: 'Consultas' },
        exito: { tipo: 'receita', planoConta: 'Honorário de Êxito' },
        multa_cancelamento: { tipo: 'receita', planoConta: 'Multa Cancelamento' },
        outros_receita: { tipo: 'receita', planoConta: 'Outros Recebimentos' },
      }
      const CATS_DESPESA: Record<string, { tipo: string; planoConta: string }> = {
        pessoal: { tipo: 'pessoal', planoConta: 'Despesas com Pessoal' },
        aluguel: { tipo: 'geral', planoConta: 'Aluguel' },
        marketing: { tipo: 'marketing', planoConta: 'Marketing' },
        servicos: { tipo: 'custo_direto', planoConta: 'Serviços Terceiros' },
        software: { tipo: 'geral', planoConta: 'Softwares e Sistemas' },
        impostos: { tipo: 'imposto', planoConta: 'Impostos e Taxas' },
        retirada: { tipo: 'retirada', planoConta: 'Retirada de Sócios' },
        outras_despesas: { tipo: 'geral', planoConta: 'Despesas Gerais' },
      }

      // Monta lançamentos agrupados por mês
      const porMes: Record<string, any[]> = {}
      for (const t of previewPdf.transacoes) {
        const data = new Date(t.data)
        const mes = data.getMonth() + 1
        const ano = data.getFullYear()
        const k = `${mes}-${ano}`
        if (!porMes[k]) porMes[k] = []
        const isReceita = t.tipo === 'receita'
        const cat = isReceita ? (CATS_RECEITA[t.categoria] || CATS_RECEITA.outros_receita) : (CATS_DESPESA[t.categoria] || CATS_DESPESA.outras_despesas)
        porMes[k].push({
          tipo: cat.tipo,
          subtipo: isReceita ? t.categoria : null,
          planoConta: cat.planoConta,
          grupoConta: isReceita ? 'Receitas' : 'Despesas',
          favorecido: t.descricao,
          descricao: t.descricao,
          valor: Number(t.valor),
          data: t.data,
          pago: true,
          mes, ano,
        })
      }

      let totalImportado = 0
      let totalDuplicatas = 0
      for (const [k, lans] of Object.entries(porMes)) {
        const [mes, ano] = k.split('-').map(Number)
        const res = await fetch('/api/v2/empresa/importar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ lancamentos: lans, mes, ano, tipo: 'extrato_pdf', nomeArquivo: `extrato_${previewPdf.banco}_${previewPdf.periodo}` }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.erro)
        totalImportado += data.inseridos ?? data.total ?? lans.length
        totalDuplicatas += data.duplicatas ?? 0
      }

      setPreviewPdf(null)
      const msgDup = totalDuplicatas > 0 ? ` (${totalDuplicatas} duplicatas ignoradas)` : ''
      setSucesso(`${totalImportado} lançamentos importados${msgDup}!`)
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setConfirmandoPdf(false)
    }
  }

  function gerarPreview(lancamentos: any[], tipo: string) {
    const por_mes: Record<string, number> = {}
    lancamentos.forEach(l => {
      const k = `${l.ano}-${String(l.mes).padStart(2, '0')}`
      por_mes[k] = (por_mes[k] || 0) + l.valor
    })
    const resumo = Object.entries(por_mes).map(([k, total]) => {
      const [ano, mes] = k.split('-').map(Number)
      return { mes, ano, total, tipo }
    }).sort((a, b) => a.ano - b.ano || a.mes - b.mes)
    setPreview({ resumo, totalLinhas: lancamentos.length, lancamentos })
  }

  async function confirmarImport() {
    if (!preview || !token || !tipoImport) return
    setImportando(true)
    setErro('')
    try {
      if (tipoImport === 'contas') {
        const res = await fetch('/api/v2/empresa/contas/importar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ contas: preview.lancamentos }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.erro)
        setSucesso(`${data.total} contas a pagar importadas com sucesso!`)
      } else {
        // Agrupa por mês e importa cada um
        const porMes: Record<string, any[]> = {}
        preview.lancamentos.forEach(l => {
          const k = `${l.mes}-${l.ano}`
          if (!porMes[k]) porMes[k] = []
          porMes[k].push(l)
        })

        let totalImportado = 0
        for (const [k, lans] of Object.entries(porMes)) {
          const [mes, ano] = k.split('-').map(Number)
          const res = await fetch('/api/v2/empresa/importar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ lancamentos: lans, mes, ano, tipo: tipoImport, nomeArquivo: `importacao_${tipoImport}_${ano}` }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.erro)
          totalImportado += data.total || lans.length
        }
        setSucesso(`${totalImportado} lançamentos importados em ${Object.keys(porMes).length} mês(es)!`)
      }
      setPreview(null)
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Importar Dados</h1>
        <p className="text-sm text-gray-500 mt-0.5">Importe o ano inteiro de uma vez — o sistema separa por mês automaticamente</p>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-5">
        {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{erro}</div>}
        {sucesso && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
            <span>✅ {sucesso}</span>
            <button onClick={() => router.push('/empresa/dashboard')} className="underline font-medium ml-4">Ver dashboard →</button>
          </div>
        )}

        {/* Preview de importação */}
        {preview && (
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-1">
              Prévia — {preview.totalLinhas} registros detectados
            </h2>
            <p className="text-sm text-gray-500 mb-4">Distribuição por mês (o sistema importa automaticamente):</p>
            <div className="space-y-2 mb-5">
              {preview.resumo.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-gray-50 px-3 py-2 rounded-lg">
                  <span className="font-medium text-gray-700">{MESES[r.mes]} {r.ano}</span>
                  <span className="text-gray-600">{formatarMoeda(r.total)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPreview(null)} className="px-4 py-2 border rounded-lg text-sm text-gray-600">Cancelar</button>
              <button
                onClick={confirmarImport}
                disabled={importando}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {importando ? 'Importando...' : `Confirmar importação`}
              </button>
            </div>
          </div>
        )}

        {/* Preview PDF */}
        {previewPdf && (
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-1">
              📄 Extrato {previewPdf.banco} — {previewPdf.periodo}
            </h2>
            <p className="text-sm text-gray-500 mb-1">{previewPdf.transacoes.length} transações identificadas</p>
            {previewPdf.observacoes && <p className="text-xs text-gray-400 mb-3 italic">{previewPdf.observacoes}</p>}
            <div className="max-h-64 overflow-y-auto space-y-1 mb-4 border rounded-lg p-2">
              {previewPdf.transacoes.map((t: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={t.tipo === 'receita' ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
                      {t.tipo === 'receita' ? '↑' : '↓'}
                    </span>
                    <span className="truncate text-gray-700">{t.descricao}</span>
                    <span className="text-gray-400 shrink-0">{t.data?.slice(0, 10)}</span>
                  </div>
                  <span className={`font-semibold shrink-0 ml-2 ${t.tipo === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                    R$ {Number(t.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPreviewPdf(null)} className="px-4 py-2 border rounded-lg text-sm text-gray-600">Cancelar</button>
              <button
                onClick={confirmarPdf}
                disabled={confirmandoPdf}
                className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {confirmandoPdf ? 'Importando...' : `✅ Importar ${previewPdf.transacoes.length} transações`}
              </button>
            </div>
          </div>
        )}

        {/* Cards de importação */}
        <div className="grid md:grid-cols-3 gap-4">
          {/* Receitas */}
          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <div className="text-2xl mb-2">💰</div>
            <h2 className="font-semibold text-gray-900">Receitas</h2>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              Importa o ano inteiro. Separa por mês via DATA VENC. Detecta receitas previstas vs recebidas.
            </p>
            <button
              onClick={() => receitasRef.current?.click()}
              disabled={loading}
              className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {loading && tipoImport === 'receitas' ? 'Lendo...' : '📂 Receitas.xlsx'}
            </button>
            <input ref={receitasRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={processarReceitas} />
          </div>

          {/* Despesas */}
          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <div className="text-2xl mb-2">💸</div>
            <h2 className="font-semibold text-gray-900">Despesas</h2>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              Importa o ano inteiro. Separa por mês via DATA COMPETÊNCIA. Detecta despesas provisionadas automaticamente.
            </p>
            <button
              onClick={() => despesasRef.current?.click()}
              disabled={loading}
              className="w-full py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50"
            >
              {loading && tipoImport === 'despesas' ? 'Lendo...' : '📂 Despesas.xlsx'}
            </button>
            <input ref={despesasRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={processarDespesas} />
          </div>

          {/* Contas a Pagar */}
          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <div className="text-2xl mb-2">📅</div>
            <h2 className="font-semibold text-gray-900">Contas a Pagar</h2>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              Importa o relatório completo. Ignora as já pagas (PG). Gera alertas semanais e no dia do vencimento.
            </p>
            <button
              onClick={() => contasRef.current?.click()}
              disabled={loading}
              className="w-full py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
            >
              {loading && tipoImport === 'contas' ? 'Lendo...' : '📂 Contas a Pagar.xlsx'}
            </button>
            <input ref={contasRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={processarContas} />
          </div>
        </div>

        {/* Extrato PDF */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-purple-100">
          <div className="flex items-start gap-4">
            <div className="text-3xl">🏦</div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">Extrato Bancário (PDF)</h2>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                A IA lê o PDF do seu banco e extrai automaticamente receitas e despesas. Funciona com qualquer banco: Sicredi, Itaú, Bradesco, BB, Nubank, etc.
              </p>
              <button
                onClick={() => pdfRef.current?.click()}
                disabled={loading}
                className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {loading && tipoImport === 'pdf' ? '⏳ Analisando PDF...' : '📄 Importar Extrato PDF'}
              </button>
              <input ref={pdfRef} type="file" accept=".pdf" className="hidden" onChange={processarPdf} />
            </div>
          </div>
        </div>

        {/* Info sobre provisionados */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
          <strong>Como funciona a detecção automática:</strong>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li><strong>Receitas:</strong> separa por DATA VENC. — PG = recebida, sem PG = prevista</li>
            <li><strong>Despesas:</strong> separa por DATA COMPETÊNCIA — SIT=OK + PG = paga, demais = provisionada</li>
            <li><strong>Contas a Pagar:</strong> agrupa por DATA VENC. — contas PG são ignoradas automaticamente</li>
          </ul>
        </div>
      </main>
    </div>
  )
}

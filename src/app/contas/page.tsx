'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { formatarMoeda } from '@/lib/utils'
import * as XLSX from 'xlsx'

const CATEGORIAS = [
  { value: 'aluguel', label: '🏢 Aluguel' },
  { value: 'salario', label: '👥 Salários / Pessoal' },
  { value: 'imposto', label: '📊 Impostos / Guias' },
  { value: 'servico', label: '💻 Serviços / Assinaturas' },
  { value: 'fornecedor', label: '📦 Fornecedores' },
  { value: 'financiamento', label: '🏦 Financiamentos / Empréstimos' },
  { value: 'outros', label: '📋 Outros' },
]

// Converte número serial do Excel para data ISO
function excelSerialToISO(serial: number): string {
  const d = new Date((serial - 25569) * 86400 * 1000)
  return d.toISOString().slice(0, 10)
}

// Mapeia plano de contas do Excel para categoria do sistema
function mapearCategoria(planoConta: string): string {
  const p = String(planoConta || '').toLowerCase()
  if (p.includes('salario') || p.includes('pessoal') || p.includes('retirada') || p.includes('advogado')) return 'salario'
  if (p.includes('aluguel')) return 'aluguel'
  if (p.includes('imposto') || p.includes('guia') || p.includes('tributo')) return 'imposto'
  if (p.includes('software') || p.includes('assinatura') || p.includes('mensalidade') || p.includes('servico') || p.includes('serviço')) return 'servico'
  if (p.includes('emprestimo') || p.includes('financiamento') || p.includes('emp.')) return 'financiamento'
  return 'outros'
}

const FREQUENCIAS = [
  { value: 'mensal', label: 'Todo mês' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'anual', label: 'Anual' },
]

function formatarData(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

function diasAteVencimento(vencimento: string): number {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const venc = new Date(vencimento)
  venc.setHours(0, 0, 0, 0)
  return Math.floor((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

type ContaPreview = {
  descricao: string
  fornecedor: string
  valor: number
  vencimento: string
  categoria: string
  observacoes: string
  selecionada: boolean
}

export default function ContasPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<any>(null)
  const [contas, setContas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [filtro, setFiltro] = useState<'todas' | 'pendente' | 'atrasado' | 'pago'>('pendente')

  // Import Excel
  const [importando, setImportando] = useState(false)
  const [preview, setPreview] = useState<ContaPreview[] | null>(null)
  const [salvandoPreview, setSalvandoPreview] = useState(false)
  const [filtroPreviewMes, setFiltroPreviewMes] = useState(0)
  const [filtroPreviewAno, setFiltroPreviewAno] = useState(0)

  // Formulário
  const [descricao, setDescricao] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [valor, setValor] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [recorrente, setRecorrente] = useState(false)
  const [frequencia, setFrequencia] = useState('mensal')
  const [categoria, setCategoria] = useState('outros')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    if (!u) { router.push('/login'); return }
    setUsuario(JSON.parse(u))
  }, [router])

  useEffect(() => {
    if (usuario) carregarContas()
  }, [usuario])

  async function carregarContas() {
    setLoading(true)
    try {
      const data = await api.getContas()
      setContas(data || [])
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!descricao || !valor || !vencimento) {
      setErro('Preencha: descrição, valor e data de vencimento.')
      return
    }

    setSalvando(true)
    setErro('')
    setSucesso('')
    try {
      await api.criarConta({
        descricao,
        fornecedor: fornecedor || undefined,
        valor: parseFloat(valor.replace(',', '.')),
        vencimento,
        recorrente,
        frequencia: recorrente ? frequencia : undefined,
        categoria,
        observacoes: observacoes || undefined,
      })
      setSucesso(recorrente
        ? `Conta recorrente criada! Ela será renovada automaticamente (${FREQUENCIAS.find(f => f.value === frequencia)?.label}).`
        : 'Conta criada com sucesso!'
      )
      setDescricao('')
      setFornecedor('')
      setValor('')
      setVencimento('')
      setRecorrente(false)
      setFrequencia('mensal')
      setCategoria('outros')
      setObservacoes('')
      setMostrarForm(false)
      carregarContas()
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  async function pagar(id: string, recorrente: boolean) {
    try {
      const res = await api.pagarConta(id)
      if (recorrente) {
        setSucesso('Conta marcada como paga! A próxima parcela foi criada automaticamente. ✅')
      } else {
        setSucesso('Conta marcada como paga! ✅')
      }
      setTimeout(() => setSucesso(''), 4000)
      carregarContas()
    } catch (e: any) {
      setErro(e.message)
    }
  }

  async function excluir(id: string) {
    if (!confirm('Remover esta conta?')) return
    try {
      await api.deletarConta(id)
      carregarContas()
    } catch (e: any) {
      setErro(e.message)
    }
  }

  async function importarExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true)
    setErro('')
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })

      // Detecta aba: tenta "Relatório Contas a Pagar", senão usa a primeira
      const abaIdx = wb.SheetNames.findIndex(n => n.toLowerCase().includes('contas a pagar') || n.toLowerCase().includes('relatorio'))
      const ws = wb.Sheets[wb.SheetNames[abaIdx >= 0 ? abaIdx : 0]]
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      // Acha linha de cabeçalho (linha com FAVORECIDO ou DESCRIÇÃO)
      const headerIdx = rows.findIndex(r => r.some((c: any) => String(c).toUpperCase().includes('FAVORECIDO') || String(c).toUpperCase().includes('DESCRIÇÃO') || String(c).toUpperCase() === 'DESCRIÇÃO' || String(c).toUpperCase() === 'DESCRICAO'))
      if (headerIdx < 0) throw new Error('Não encontrei o cabeçalho da planilha. Verifique se a aba tem colunas FAVORECIDO, DESCRIÇÃO, VALOR, DATA VENC.')

      const header: string[] = rows[headerIdx].map((h: any) => String(h).toUpperCase().trim())
      const isFavorecido = header.findIndex(h => h.includes('FAVORECIDO'))
      const isDescricao = header.findIndex(h => h.includes('DESCRI'))
      const isValor = header.findIndex(h => h === 'VALOR')
      const isData = header.findIndex(h => h.includes('DATA'))
      const isStatus = header.findIndex(h => h === 'STATUS')
      const isPg = header.findIndex(h => h === 'PG')
      const isPlanoConta = header.findIndex(h => h.includes('PLANO'))

      const dataRows = rows.slice(headerIdx + 1).filter(r => r[isFavorecido] || r[isDescricao])

      const contasImport: ContaPreview[] = []
      for (const row of dataRows) {
        const pg = String(row[isPg] ?? '').toUpperCase().trim()
        const status = String(row[isStatus] ?? '').toUpperCase().trim()
        // Importa apenas as NÃO pagas (PG vazio) — ignora as já pagas
        if (pg === 'PG') continue

        const valorRaw = row[isValor]
        const valor = parseFloat(String(valorRaw).replace(',', '.'))
        if (!valor || isNaN(valor) || valor <= 0) continue

        const dataRaw = row[isData]
        let vencimento = ''
        if (typeof dataRaw === 'number') {
          vencimento = excelSerialToISO(dataRaw)
        } else if (typeof dataRaw === 'string' && dataRaw.includes('/')) {
          const [d, m, a] = dataRaw.split('/')
          vencimento = `${a}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
        } else {
          continue
        }

        const favorecido = String(row[isFavorecido] ?? '').trim()
        const descricaoRaw = String(row[isDescricao] ?? '').trim()
        const planoConta = isPlanoConta >= 0 ? String(row[isPlanoConta] ?? '') : ''

        contasImport.push({
          descricao: descricaoRaw || favorecido,
          fornecedor: favorecido,
          valor,
          vencimento,
          categoria: mapearCategoria(planoConta),
          observacoes: status === 'PREV' ? 'Previsto' : '',
          selecionada: true,
        })
      }

      if (contasImport.length === 0) throw new Error('Nenhuma conta a pagar pendente encontrada na planilha.')

      // Detecta anos disponíveis para filtro
      setPreview(contasImport)
      setFiltroPreviewMes(0)
      setFiltroPreviewAno(0)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setImportando(false)
      e.target.value = ''
    }
  }

  async function confirmarImport() {
    if (!preview || !usuario) return
    setSalvandoPreview(true)
    setErro('')
    try {
      const selecionadas = previewFiltradas.filter(c => c.selecionada)
      if (selecionadas.length === 0) { setErro('Selecione ao menos uma conta'); return }

      const token = localStorage.getItem('radar_token')
      const res = await fetch('/api/contas/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clienteId: usuario.id, contas: selecionadas })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.erro)

      setSucesso(`${result.total} contas importadas com sucesso!`)
      setTimeout(() => setSucesso(''), 5000)
      setPreview(null)
      carregarContas()
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvandoPreview(false)
    }
  }

  function exportarExcel() {
    const STATUS_NOME_EXP: Record<string, string> = { pendente: 'Pendente', atrasado: 'Atrasada', pago: 'Pago' }
    const dados = contas.map(c => ({
      'Descrição': c.descricao,
      'Fornecedor': c.fornecedor || '',
      'Categoria': CATEGORIAS.find(cat => cat.value === c.categoria)?.label?.replace(/^[^\s]+\s/, '') || c.categoria,
      'Valor (R$)': Number(c.valor),
      'Vencimento': new Date(c.vencimento).toLocaleDateString('pt-BR'),
      'Status': STATUS_NOME_EXP[c.status] || c.status,
      'Recorrente': c.recorrente ? (FREQUENCIAS.find(f => f.value === c.frequencia)?.label || 'Sim') : 'Não',
      'Observações': c.observacoes || '',
    }))

    const ws = XLSX.utils.json_to_sheet(dados)
    ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 25 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Contas a Pagar')
    XLSX.writeFile(wb, `contas-a-pagar-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const anosPreview = preview ? [...new Set(preview.map(c => new Date(c.vencimento).getFullYear()))].sort() : []
  const mesesPreview = preview ? [...new Set(preview.map(c => new Date(c.vencimento).getMonth() + 1))].sort((a, b) => a - b) : []
  const previewFiltradas = (preview || []).filter(c => {
    const d = new Date(c.vencimento)
    if (filtroPreviewMes && d.getMonth() + 1 !== filtroPreviewMes) return false
    if (filtroPreviewAno && d.getFullYear() !== filtroPreviewAno) return false
    return true
  })
  const totalSelecionadas = previewFiltradas.filter(c => c.selecionada).length

  const contasFiltradas = contas.filter(c => filtro === 'todas' || c.status === filtro)

  const totalPendente = contas
    .filter(c => c.status === 'pendente' || c.status === 'atrasado')
    .reduce((s, c) => s + Number(c.valor), 0)

  const qtdAtrasadas = contas.filter(c => c.status === 'atrasado').length
  const qtdHoje = contas.filter(c => {
    const dias = diasAteVencimento(c.vencimento)
    return c.status === 'pendente' && dias === 0
  }).length

  const STATUS_COR: Record<string, string> = {
    pendente: 'bg-yellow-100 text-yellow-700',
    atrasado: 'bg-red-100 text-red-700',
    pago: 'bg-green-100 text-green-700',
  }
  const STATUS_NOME: Record<string, string> = {
    pendente: 'Pendente',
    atrasado: 'ATRASADA',
    pago: 'Pago',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contas a Pagar</h1>
          <p className="text-sm text-gray-500">Gerencie seus vencimentos e receba alertas</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setMostrarForm(!mostrarForm); setErro(''); setSucesso('') }}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            + Nova Conta
          </button>
          <label className={`px-3 py-2 text-sm rounded-lg font-medium cursor-pointer transition ${importando ? 'bg-gray-100 text-gray-400' : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'}`}>
            {importando ? 'Lendo...' : '📂 Importar Excel'}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={importarExcel} disabled={importando} />
          </label>
          <button
            onClick={exportarExcel}
            disabled={contas.length === 0}
            className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 font-medium"
          >
            📥 Excel
          </button>
          <button onClick={() => router.push('/lancamentos')} className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            ↑↓ Lançamentos
          </button>
          <button onClick={() => router.push('/dashboard')} className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            ← Dashboard
          </button>
        </div>
      </header>

      {/* Modal Preview Import */}
      {preview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Prévia — Importar Contas a Pagar</h2>
                <p className="text-sm text-gray-500">{preview.length} contas pendentes encontradas na planilha</p>
              </div>
              <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>

            {/* Filtros mês/ano */}
            <div className="px-6 py-3 border-b bg-gray-50 flex flex-wrap gap-2 items-center">
              <span className="text-xs font-medium text-gray-500">Filtrar por vencimento:</span>
              <select value={filtroPreviewAno} onChange={e => setFiltroPreviewAno(+e.target.value)} className="px-2 py-1 border rounded text-sm">
                <option value={0}>Todos os anos</option>
                {anosPreview.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={filtroPreviewMes} onChange={e => setFiltroPreviewMes(+e.target.value)} className="px-2 py-1 border rounded text-sm">
                <option value={0}>Todos os meses</option>
                {mesesPreview.map(m => <option key={m} value={m}>{['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][m]}</option>)}
              </select>
              <span className="text-xs text-gray-400 ml-auto">{previewFiltradas.length} visíveis</span>
              <button onClick={() => setPreview(prev => prev!.map(c => previewFiltradas.includes(c) ? {...c, selecionada: true} : c))} className="text-xs text-blue-600 hover:underline">Marcar todas</button>
              <button onClick={() => setPreview(prev => prev!.map(c => previewFiltradas.includes(c) ? {...c, selecionada: false} : c))} className="text-xs text-gray-500 hover:underline">Desmarcar todas</button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y">
              {previewFiltradas.length === 0 ? (
                <p className="text-center text-gray-400 py-10">Nenhuma conta para este filtro</p>
              ) : previewFiltradas.map((c, i) => (
                <label key={i} className={`flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-gray-50 ${!c.selecionada ? 'opacity-40' : ''}`}>
                  <input
                    type="checkbox"
                    checked={c.selecionada}
                    onChange={() => setPreview(prev => prev!.map(item => item === c ? {...item, selecionada: !item.selecionada} : item))}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.descricao}</p>
                    <p className="text-xs text-gray-400">
                      {c.fornecedor && c.fornecedor !== c.descricao && <span>{c.fornecedor} · </span>}
                      Vence: {new Date(c.vencimento).toLocaleDateString('pt-BR')}
                      {c.observacoes && <span className="ml-1 text-orange-500">· {c.observacoes}</span>}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-gray-800 flex-shrink-0">{formatarMoeda(c.valor)}</span>
                </label>
              ))}
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600"><span className="font-bold text-blue-600">{totalSelecionadas}</span> contas selecionadas</p>
                <p className="text-xs text-gray-400">
                  Total: {formatarMoeda(previewFiltradas.filter(c => c.selecionada).reduce((s, c) => s + c.valor, 0))}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPreview(null)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">Cancelar</button>
                <button
                  onClick={confirmarImport}
                  disabled={salvandoPreview || totalSelecionadas === 0}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {salvandoPreview ? 'Importando...' : `Importar ${totalSelecionadas} conta(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Alertas de urgência */}
        {qtdAtrasadas > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <p className="font-semibold text-red-800">
                {qtdAtrasadas} conta{qtdAtrasadas > 1 ? 's' : ''} atrasada{qtdAtrasadas > 1 ? 's' : ''}!
              </p>
              <p className="text-sm text-red-600">Resolva o quanto antes para evitar juros e problemas.</p>
            </div>
          </div>
        )}

        {qtdHoje > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">📌</span>
            <div>
              <p className="font-semibold text-orange-800">
                {qtdHoje} conta{qtdHoje > 1 ? 's' : ''} vence{qtdHoje > 1 ? 'm' : ''} hoje!
              </p>
              <p className="text-sm text-orange-600">Não esqueça de efetuar o pagamento hoje.</p>
            </div>
          </div>
        )}

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{erro}</div>}
        {sucesso && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 text-sm">{sucesso}</div>}

        {/* Formulário nova conta */}
        {mostrarForm && (
          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <h2 className="text-lg font-semibold text-gray-800 mb-5">Nova Conta a Pagar</h2>
            <form onSubmit={salvar} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
                <input
                  type="text"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Aluguel do escritório"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIAS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor / Quem recebe</label>
                <input
                  type="text"
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  placeholder="Nome do fornecedor"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Vencimento *</label>
                <input
                  type="date"
                  value={vencimento}
                  onChange={(e) => setVencimento(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <input
                  type="text"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recorrente}
                    onChange={(e) => setRecorrente(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Conta recorrente (se repete automaticamente)</span>
                </label>

                {recorrente && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frequência</label>
                    <select
                      value={frequencia}
                      onChange={(e) => setFrequencia(e.target.value)}
                      className="w-48 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      {FREQUENCIAS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      Quando você marcar como pago, a próxima parcela será criada automaticamente.
                    </p>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 flex gap-3">
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Salvar Conta'}
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarForm(false)}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-200"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Resumo + Filtros */}
        <div className="flex items-center justify-between">
          <div className="bg-white rounded-xl px-5 py-3 shadow-sm border flex items-center gap-4">
            <div>
              <p className="text-xs text-gray-500">Total em aberto</p>
              <p className="text-xl font-bold text-gray-800">{formatarMoeda(totalPendente)}</p>
            </div>
          </div>

          <div className="flex gap-1 bg-white rounded-lg border shadow-sm p-1">
            {(['pendente', 'atrasado', 'pago', 'todas'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                  filtro === f ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {f === 'pendente' ? 'Pendentes' : f === 'atrasado' ? '⚠️ Atrasadas' : f === 'pago' ? 'Pagas' : 'Todas'}
                {f !== 'todas' && (
                  <span className="ml-1.5 text-xs opacity-70">
                    ({contas.filter(c => c.status === f).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de contas */}
        {loading ? (
          <p className="text-center text-gray-400 py-12">Carregando...</p>
        ) : contasFiltradas.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm border">
            <p className="text-gray-400 text-lg">
              {filtro === 'pendente' ? '✅ Nenhuma conta pendente!' : `Nenhuma conta ${filtro === 'atrasado' ? 'atrasada' : filtro === 'pago' ? 'paga' : ''}`}
            </p>
            {filtro === 'pendente' && (
              <p className="text-gray-300 text-sm mt-2">Clique em "+ Nova Conta" para adicionar um vencimento.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {contasFiltradas.map((c) => {
              const dias = diasAteVencimento(c.vencimento)
              const catLabel = CATEGORIAS.find(cat => cat.value === c.categoria)?.label || c.categoria
              return (
                <div
                  key={c.id}
                  className={`bg-white rounded-xl p-5 shadow-sm border transition-all ${
                    c.status === 'atrasado' ? 'border-red-200 bg-red-50/30' :
                    dias === 0 && c.status === 'pendente' ? 'border-orange-200 bg-orange-50/20' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800">{c.descricao}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COR[c.status]}`}>
                          {STATUS_NOME[c.status]}
                        </span>
                        {c.recorrente && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">
                            🔄 {FREQUENCIAS.find(f => f.value === c.frequencia)?.label || 'Recorrente'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                        <span>{catLabel}</span>
                        {c.fornecedor && <span>· {c.fornecedor}</span>}
                        <span>· Vence: {formatarData(c.vencimento)}</span>
                        {c.status === 'pendente' && (
                          <span className={dias < 0 ? 'text-red-500' : dias === 0 ? 'text-orange-500 font-semibold' : dias <= 3 ? 'text-yellow-600' : 'text-gray-400'}>
                            {dias < 0 ? `⚠️ ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? 's' : ''} atrasada` :
                             dias === 0 ? '📌 vence hoje' :
                             `em ${dias} dia${dias > 1 ? 's' : ''}`}
                          </span>
                        )}
                        {c.observacoes && <span>· {c.observacoes}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-xl font-bold text-gray-800">{formatarMoeda(Number(c.valor))}</p>
                      <div className="flex gap-2">
                        {c.status !== 'pago' && (
                          <button
                            onClick={() => pagar(c.id, c.recorrente)}
                            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium"
                          >
                            ✓ Pago
                          </button>
                        )}
                        <button
                          onClick={() => excluir(c.id)}
                          className="px-3 py-1.5 bg-gray-100 text-gray-500 text-sm rounded-lg hover:bg-red-50 hover:text-red-500"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

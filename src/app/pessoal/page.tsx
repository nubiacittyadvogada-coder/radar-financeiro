'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { formatarMoeda } from '@/lib/utils'
import * as XLSX from 'xlsx'

const CATEGORIAS_RECEITA = ['Salário', 'Freelance / Consultoria', 'Aluguel recebido', 'Investimentos', 'Outros']
const CATEGORIAS_DESPESA = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Vestuário', 'Serviços / Assinaturas', 'Impostos pessoais', 'Investimentos', 'Outros']
const CARTOES = ['Nubank', 'Inter', 'XP', 'Itaú', 'Bradesco', 'Santander', 'C6 Bank', 'Outro cartão']
const MESES_FULL = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MESES_ABREV = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function PessoalPage() {
  const router = useRouter()
  const [aba, setAba] = useState<'extrato' | 'anual' | 'cartoes' | 'analise'>('extrato')
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [transacoes, setTransacoes] = useState<any[]>([])
  const [transacoesAnual, setTransacoesAnual] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [analise, setAnalise] = useState<any>(null)
  const [loadingSetup, setLoadingSetup] = useState(true)
  const [loadingTransacoes, setLoadingTransacoes] = useState(false)
  const [loadingAnual, setLoadingAnual] = useState(false)
  const [loadingAnalise, setLoadingAnalise] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'receita' | 'despesa'>('todos')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [importando, setImportando] = useState(false)

  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())

  // Form
  const [fTipo, setFTipo] = useState<'receita' | 'despesa'>('despesa')
  const [fDescricao, setFDescricao] = useState('')
  const [fValor, setFValor] = useState('')
  const [fData, setFData] = useState(hoje.toISOString().slice(0, 10))
  const [fCategoria, setFCategoria] = useState('Outros')
  const [fCartao, setFCartao] = useState('')
  const [fObs, setFObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    if (!u) { router.push('/login'); return }
    setup()
  }, [])

  useEffect(() => {
    if (clienteId) carregarTransacoes()
  }, [clienteId, mes, ano])

  useEffect(() => {
    if (clienteId && aba === 'anual') carregarAnual()
  }, [clienteId, aba, ano])

  async function setup() {
    try {
      const token = localStorage.getItem('radar_token')
      const res = await fetch('/api/pessoal/setup', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.clienteId) setClienteId(data.clienteId)
      else setErro('Erro ao inicializar perfil pessoal')
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setLoadingSetup(false)
    }
  }

  async function carregarTransacoes() {
    setLoadingTransacoes(true)
    try {
      const token = localStorage.getItem('radar_token')
      const res = await fetch(`/api/pessoal/transacoes?clienteId=${clienteId}&mes=${mes}&ano=${ano}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setTransacoes(data.transacoes || [])
      setStats(data.stats || null)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setLoadingTransacoes(false)
    }
  }

  async function carregarAnual() {
    setLoadingAnual(true)
    try {
      const token = localStorage.getItem('radar_token')
      const res = await fetch(`/api/pessoal/transacoes?clienteId=${clienteId}&ano=${ano}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setTransacoesAnual(data.transacoes || [])
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setLoadingAnual(false)
    }
  }

  // Agrupa transações anuais por mês
  const resumoAnual = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const ts = transacoesAnual.filter(t => t.mes === m)
    const receitas = ts.filter(t => t.tipo === 'receita').reduce((s, t) => s + Math.abs(Number(t.valor)), 0)
    const despesas = ts.filter(t => t.tipo === 'despesa').reduce((s, t) => s + Math.abs(Number(t.valor)), 0)
    return { mes: m, receitas, despesas, saldo: receitas - despesas, count: ts.length }
  })

  const totalAnual = {
    receitas: resumoAnual.reduce((s, m) => s + m.receitas, 0),
    despesas: resumoAnual.reduce((s, m) => s + m.despesas, 0),
    saldo: resumoAnual.reduce((s, m) => s + m.saldo, 0),
  }

  async function salvarTransacao(e: React.FormEvent) {
    e.preventDefault()
    if (!fDescricao || !fValor || !fData) return
    setSalvando(true)
    setErro('')
    try {
      const token = localStorage.getItem('radar_token')
      const res = await fetch('/api/pessoal/transacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          clienteId,
          tipo: fTipo,
          descricao: fDescricao,
          valor: fValor,
          data: fData,
          categoria: fCategoria,
          cartao: fCartao || undefined,
          observacoes: fObs || undefined,
        })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.erro) }
      setSucesso('Transação adicionada!')
      setTimeout(() => setSucesso(''), 3000)
      setFDescricao(''); setFValor(''); setFCartao(''); setFObs('')
      setMostrarForm(false)
      carregarTransacoes()
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string) {
    if (!confirm('Remover esta transação?')) return
    const token = localStorage.getItem('radar_token')
    await fetch(`/api/pessoal/transacoes/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    carregarTransacoes()
    if (aba === 'anual') carregarAnual()
  }

  async function gerarAnalise() {
    setLoadingAnalise(true)
    setErro('')
    try {
      const token = localStorage.getItem('radar_token')
      const res = await fetch('/api/pessoal/analise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clienteId })
      })
      const data = await res.json()
      if (data.erro) throw new Error(data.erro)
      setAnalise(data)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setLoadingAnalise(false)
    }
  }

  function baixarModelo() {
    const modelo = [
      { data: '01/04/2026', descricao: 'Salário', tipo: 'receita', valor: '5000', categoria: 'Salário', cartao: '', observacoes: '' },
      { data: '05/04/2026', descricao: 'Mercado', tipo: 'despesa', valor: '450', categoria: 'Alimentação', cartao: 'Nubank', observacoes: '' },
      { data: '10/04/2026', descricao: 'Uber', tipo: 'despesa', valor: '35.50', categoria: 'Transporte', cartao: '', observacoes: 'App' },
    ]
    const ws = XLSX.utils.json_to_sheet(modelo)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Transações')
    XLSX.writeFile(wb, 'modelo_financas_pessoais.xlsx')
  }

  async function importarExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !clienteId) return
    setImportando(true)
    setErro('')
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { raw: false })

      if (rows.length === 0) throw new Error('Planilha vazia')

      const transacoesImport = rows.map((row: any, idx: number) => {
        // Suporta data em formato dd/mm/aaaa ou aaaa-mm-dd
        let data = row['data'] || row['Data'] || row['DATA']
        if (!data) throw new Error(`Linha ${idx + 2}: campo "data" obrigatório`)

        // Converte dd/mm/aaaa → aaaa-mm-dd
        if (typeof data === 'string' && data.includes('/')) {
          const [d, m, a] = data.split('/')
          data = `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
        }

        const descricao = row['descricao'] || row['Descricao'] || row['descrição'] || row['Descrição'] || row['DESCRICAO']
        const tipo = String(row['tipo'] || row['Tipo'] || row['TIPO'] || 'despesa').toLowerCase().trim()
        const valorRaw = row['valor'] || row['Valor'] || row['VALOR']
        const valor = parseFloat(String(valorRaw).replace(',', '.'))

        if (!descricao) throw new Error(`Linha ${idx + 2}: campo "descricao" obrigatório`)
        if (isNaN(valor)) throw new Error(`Linha ${idx + 2}: "valor" inválido (${valorRaw})`)
        if (!['receita', 'despesa'].includes(tipo)) throw new Error(`Linha ${idx + 2}: "tipo" deve ser "receita" ou "despesa"`)

        return {
          data,
          descricao: String(descricao).trim(),
          tipo,
          valor,
          categoria: row['categoria'] || row['Categoria'] || row['CATEGORIA'] || 'Outros',
          cartao: row['cartao'] || row['Cartao'] || row['cartão'] || row['Cartão'] || '',
          observacoes: row['observacoes'] || row['Observacoes'] || row['observações'] || '',
        }
      })

      const token = localStorage.getItem('radar_token')
      const res = await fetch('/api/pessoal/transacoes/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clienteId, transacoes: transacoesImport })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.erro)

      setSucesso(`${result.total} transações importadas com sucesso!`)
      setTimeout(() => setSucesso(''), 5000)
      carregarTransacoes()
      if (aba === 'anual') carregarAnual()
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setImportando(false)
      e.target.value = ''
    }
  }

  if (loadingSetup) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Carregando...</p></div>

  const transacoesFiltradas = filtroTipo === 'todos' ? transacoes : transacoes.filter(t => t.tipo === filtroTipo)
  const cartaoTransacoes = transacoes.filter(t => t.grupoConta === 'pessoal_cartao')
  const cartoesUnicos = [...new Set(cartaoTransacoes.map(t => t.tipoContabil || 'Sem nome'))]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-sm">← Voltar</button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Finanças Pessoais</h1>
            <p className="text-sm text-gray-500">Controle sua vida financeira além da empresa</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={mes} onChange={e => setMes(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{MESES_FULL[i + 1]}</option>
            ))}
          </select>
          <select value={ano} onChange={e => setAno(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            {[2023, 2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </header>

      {/* Abas */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-1">
          {([
            { id: 'extrato', label: '📊 Extrato' },
            { id: 'anual', label: '📅 Visão Anual' },
            { id: 'cartoes', label: '💳 Cartões' },
            { id: 'analise', label: '✦ Análise IA' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setAba(tab.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                aba === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{erro} <button onClick={() => setErro('')} className="ml-2 font-bold">✕</button></div>}
        {sucesso && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{sucesso}</div>}

        {/* ===== ABA EXTRATO ===== */}
        {aba === 'extrato' && (
          <div className="space-y-4">
            {/* Cards de resumo */}
            {stats && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-xs text-green-600 font-medium">Receitas</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">{formatarMoeda(stats.receitas)}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-xs text-red-600 font-medium">Despesas</p>
                  <p className="text-2xl font-bold text-red-700 mt-1">{formatarMoeda(Math.abs(stats.despesas))}</p>
                </div>
                <div className={`border rounded-xl p-4 ${stats.saldo >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                  <p className={`text-xs font-medium ${stats.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Saldo</p>
                  <p className={`text-2xl font-bold mt-1 ${stats.saldo >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{formatarMoeda(stats.saldo)}</p>
                </div>
              </div>
            )}

            {/* Barra de ações */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-700">
                  {MESES_FULL[mes]} {ano}
                  <span className="text-sm font-normal text-gray-400 ml-2">({transacoes.length})</span>
                </h2>
                {/* Filtro tipo */}
                <div className="flex rounded-lg border overflow-hidden text-xs">
                  {(['todos', 'receita', 'despesa'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFiltroTipo(f)}
                      className={`px-3 py-1.5 font-medium transition ${
                        filtroTipo === f
                          ? f === 'receita' ? 'bg-green-600 text-white' : f === 'despesa' ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {f === 'todos' ? 'Todos' : f === 'receita' ? '↑ Receitas' : '↓ Despesas'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 items-center">
                {/* Importar Excel */}
                <label className={`px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition ${importando ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'}`}>
                  {importando ? 'Importando...' : '📥 Importar Excel'}
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importarExcel} disabled={importando} />
                </label>
                <button
                  onClick={baixarModelo}
                  className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
                  title="Baixar modelo de planilha"
                >
                  ⬇ Modelo
                </button>
                <button
                  onClick={() => setMostrarForm(!mostrarForm)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  + Adicionar
                </button>
              </div>
            </div>

            {mostrarForm && (
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Nova Transação</h3>
                <form onSubmit={salvarTransacao} className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <div className="flex gap-2">
                      {(['despesa', 'receita'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => { setFTipo(t); setFCategoria('Outros') }}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                            fTipo === t
                              ? t === 'despesa' ? 'bg-red-600 text-white border-red-600' : 'bg-green-600 text-white border-green-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {t === 'despesa' ? '↓ Despesa' : '↑ Receita'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Descrição *</label>
                    <input
                      type="text"
                      value={fDescricao}
                      onChange={e => setFDescricao(e.target.value)}
                      placeholder={fTipo === 'receita' ? 'Ex: Salário abril' : 'Ex: Mercado, Uber, Netflix...'}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Valor (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={fValor}
                      onChange={e => setFValor(e.target.value)}
                      placeholder="0,00"
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Data *</label>
                    <input
                      type="date"
                      value={fData}
                      onChange={e => setFData(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
                    <select
                      value={fCategoria}
                      onChange={e => setFCategoria(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      {(fTipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {fTipo === 'despesa' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cartão (opcional)</label>
                      <select
                        value={fCartao}
                        onChange={e => setFCartao(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Débito / Pix / Dinheiro</option>
                        {CARTOES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
                    <input
                      type="text"
                      value={fObs}
                      onChange={e => setFObs(e.target.value)}
                      placeholder="Opcional"
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="col-span-2 flex gap-2">
                    <button
                      type="submit"
                      disabled={salvando}
                      className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {salvando ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button type="button" onClick={() => setMostrarForm(false)} className="px-5 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Lista de transações */}
            {loadingTransacoes ? (
              <p className="text-center text-gray-400 py-8">Carregando...</p>
            ) : transacoesFiltradas.length === 0 ? (
              <div className="bg-white rounded-xl border p-10 text-center">
                <p className="text-gray-400">
                  {filtroTipo === 'todos'
                    ? `Nenhuma transação em ${MESES_FULL[mes]} ${ano}`
                    : `Nenhuma ${filtroTipo === 'receita' ? 'receita' : 'despesa'} em ${MESES_FULL[mes]} ${ano}`}
                </p>
                {filtroTipo === 'todos' && (
                  <button onClick={() => setMostrarForm(true)} className="mt-3 text-blue-600 text-sm hover:underline">
                    + Adicionar primeira transação
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border divide-y">
                {transacoesFiltradas.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.tipo === 'receita' ? 'bg-green-500' : 'bg-red-400'}`} />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{t.descricao}</p>
                        <p className="text-xs text-gray-400">
                          {t.planoConta}
                          {t.grupoConta === 'pessoal_cartao' && t.tipoContabil && (
                            <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded text-xs">💳 {t.tipoContabil}</span>
                          )}
                          {' · '}{new Date(t.data).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold text-sm ${t.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.tipo === 'receita' ? '+' : '-'}{formatarMoeda(Math.abs(Number(t.valor)))}
                      </span>
                      <button onClick={() => excluir(t.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Gastos por categoria */}
            {stats?.porCategoria && Object.keys(stats.porCategoria).length > 0 && filtroTipo !== 'receita' && (
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-700 mb-3">Gastos por Categoria</h3>
                <div className="space-y-2">
                  {Object.entries(stats.porCategoria as Record<string, number>)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, val]) => {
                      const v = Math.abs(val as number)
                      const pct = stats.receitas > 0 ? (v / stats.receitas) * 100 : 0
                      return (
                        <div key={cat}>
                          <div className="flex justify-between text-sm mb-0.5">
                            <span className="text-gray-700">{cat}</span>
                            <span className="text-gray-500">{formatarMoeda(v)} <span className="text-xs text-gray-400">({pct.toFixed(0)}%)</span></span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full">
                            <div className="h-1.5 bg-red-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== ABA ANUAL ===== */}
        {aba === 'anual' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">Resumo {ano} — mês a mês</h2>
              <select value={ano} onChange={e => setAno(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
                {[2023, 2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {loadingAnual ? (
              <p className="text-center text-gray-400 py-8">Carregando...</p>
            ) : (
              <>
                {/* Tabela anual */}
                <div className="bg-white rounded-xl border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Mês</th>
                        <th className="px-4 py-3 text-right font-medium text-green-600">Receitas</th>
                        <th className="px-4 py-3 text-right font-medium text-red-600">Despesas</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Saldo</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-400">Lançamentos</th>
                        <th className="px-4 py-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {resumoAnual.map(m => (
                        <tr key={m.mes} className={`hover:bg-gray-50 transition ${m.mes === mes ? 'bg-blue-50' : ''}`}>
                          <td className="px-4 py-3 font-medium text-gray-800">{MESES_ABREV[m.mes]}</td>
                          <td className="px-4 py-3 text-right text-green-600 font-medium">
                            {m.receitas > 0 ? formatarMoeda(m.receitas) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-red-600 font-medium">
                            {m.despesas > 0 ? formatarMoeda(m.despesas) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${m.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            {m.count > 0 ? formatarMoeda(m.saldo) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-400 text-xs">{m.count > 0 ? m.count : '—'}</td>
                          <td className="px-4 py-3 text-right">
                            {m.count > 0 && (
                              <button
                                onClick={() => { setMes(m.mes); setAba('extrato'); setFiltroTipo('todos') }}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Ver →
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t font-bold">
                      <tr>
                        <td className="px-4 py-3 text-gray-700">Total {ano}</td>
                        <td className="px-4 py-3 text-right text-green-600">{formatarMoeda(totalAnual.receitas)}</td>
                        <td className="px-4 py-3 text-right text-red-600">{formatarMoeda(totalAnual.despesas)}</td>
                        <td className={`px-4 py-3 text-right ${totalAnual.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatarMoeda(totalAnual.saldo)}</td>
                        <td className="px-4 py-3 text-right text-gray-400 text-xs">{transacoesAnual.length}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Cards resumo do ano */}
                {transacoesAnual.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-green-600 font-medium">Total Recebido {ano}</p>
                      <p className="text-xl font-bold text-green-700 mt-1">{formatarMoeda(totalAnual.receitas)}</p>
                      <p className="text-xs text-green-500 mt-1">
                        {formatarMoeda(totalAnual.receitas / 12)}/mês médio
                      </p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-red-600 font-medium">Total Gasto {ano}</p>
                      <p className="text-xl font-bold text-red-700 mt-1">{formatarMoeda(totalAnual.despesas)}</p>
                      <p className="text-xs text-red-500 mt-1">
                        {formatarMoeda(totalAnual.despesas / 12)}/mês médio
                      </p>
                    </div>
                    <div className={`border rounded-xl p-4 text-center ${totalAnual.saldo >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                      <p className={`text-xs font-medium ${totalAnual.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Saldo {ano}</p>
                      <p className={`text-xl font-bold mt-1 ${totalAnual.saldo >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{formatarMoeda(totalAnual.saldo)}</p>
                      {totalAnual.receitas > 0 && (
                        <p className={`text-xs mt-1 ${totalAnual.saldo >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>
                          {((totalAnual.saldo / totalAnual.receitas) * 100).toFixed(1)}% poupado
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ===== ABA CARTÕES ===== */}
        {aba === 'cartoes' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-gray-700">Cartões — {MESES_FULL[mes]} {ano}</h2>
              <button
                onClick={() => { setFTipo('despesa'); setMostrarForm(true); setAba('extrato') }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
              >
                + Lançar no cartão
              </button>
            </div>

            {cartaoTransacoes.length === 0 ? (
              <div className="bg-white rounded-xl border p-10 text-center">
                <p className="text-4xl mb-3">💳</p>
                <p className="text-gray-500 font-medium">Nenhum gasto em cartão registrado</p>
                <p className="text-gray-400 text-sm mt-1">Adicione transações com cartão na aba Extrato</p>
              </div>
            ) : (
              <>
                {stats?.cartao !== 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-purple-600 font-medium">Total em cartões</p>
                      <p className="text-2xl font-bold text-purple-700">{formatarMoeda(Math.abs(stats.cartao))}</p>
                    </div>
                    {stats.receitas > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-purple-500">{((Math.abs(stats.cartao) / stats.receitas) * 100).toFixed(1)}% da renda</p>
                        {Math.abs(stats.cartao) / stats.receitas > 0.3 && (
                          <p className="text-xs text-red-500 font-medium mt-1">⚠ Alto uso do cartão</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {cartoesUnicos.map(cartaoNome => {
                  const gastoCartao = cartaoTransacoes.filter(t => (t.tipoContabil || 'Sem nome') === cartaoNome)
                  const total = gastoCartao.reduce((s, t) => s + Math.abs(Number(t.valor)), 0)
                  const porCat: Record<string, number> = {}
                  gastoCartao.forEach(t => { porCat[t.planoConta] = (porCat[t.planoConta] || 0) + Math.abs(Number(t.valor)) })

                  return (
                    <div key={cartaoNome} className="bg-white rounded-xl border p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                          <span className="text-xl">💳</span> {cartaoNome}
                        </h3>
                        <span className="text-xl font-bold text-purple-700">{formatarMoeda(total)}</span>
                      </div>
                      <div className="space-y-1 mb-4">
                        {Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                          <div key={cat} className="flex justify-between text-sm text-gray-600">
                            <span>{cat}</span>
                            <span className="font-medium">{formatarMoeda(val)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t pt-3 space-y-1">
                        {gastoCartao.map(t => (
                          <div key={t.id} className="flex justify-between text-xs text-gray-500 py-1">
                            <span>{new Date(t.data).toLocaleDateString('pt-BR')} · {t.descricao}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-red-500 font-medium">-{formatarMoeda(Math.abs(Number(t.valor)))}</span>
                              <button onClick={() => excluir(t.id)} className="text-gray-300 hover:text-red-400">✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

        {/* ===== ABA ANÁLISE IA ===== */}
        {aba === 'analise' && (
          <div className="space-y-4">
            {!analise && !loadingAnalise && (
              <div className="bg-white rounded-xl border p-12 text-center">
                <div className="text-5xl mb-4">✦</div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Análise das suas finanças pessoais</h2>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  A IA vai analisar todas as suas transações e dar conselhos práticos sobre onde cortar gastos, como poupar mais e organizar sua vida financeira.
                </p>
                <button onClick={gerarAnalise} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700">
                  Gerar Análise Agora
                </button>
              </div>
            )}

            {loadingAnalise && (
              <div className="bg-white rounded-xl border p-12 text-center">
                <div className="text-4xl animate-pulse mb-4">⟳</div>
                <p className="text-gray-600">Analisando suas finanças pessoais...</p>
              </div>
            )}

            {analise && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button onClick={gerarAnalise} disabled={loadingAnalise} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    ↺ Atualizar análise
                  </button>
                </div>

                {analise.analise?.diagnostico && (
                  <div className="bg-white rounded-xl border p-6">
                    <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <span className="text-blue-600">◉</span> Diagnóstico
                    </h2>
                    <p className="text-gray-700 leading-relaxed">{analise.analise.diagnostico}</p>
                  </div>
                )}

                {analise.analise?.pontosCriticos?.length > 0 && (
                  <div className="bg-red-50 rounded-xl border border-red-100 p-6">
                    <h2 className="font-bold text-red-800 mb-3">⚠ Pontos de atenção</h2>
                    <ul className="space-y-2">
                      {analise.analise.pontosCriticos.map((p: string, i: number) => (
                        <li key={i} className="flex gap-2 text-red-700 text-sm">
                          <span className="font-bold">{i + 1}.</span> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analise.analise?.dicas?.length > 0 && (
                    <div className="bg-white rounded-xl border p-5">
                      <h2 className="font-bold text-gray-800 mb-3">💡 Como melhorar</h2>
                      <div className="space-y-3">
                        {analise.analise.dicas.map((d: any, i: number) => (
                          <div key={i} className="border-l-4 border-green-300 pl-3">
                            <p className="font-medium text-gray-800 text-sm">{d.titulo}</p>
                            <p className="text-xs text-gray-600 mt-0.5">{d.descricao}</p>
                            {d.impacto && <p className="text-xs text-green-600 mt-0.5 font-medium">{d.impacto}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {analise.analise?.metaPoupanca && (
                    <div className="bg-blue-50 rounded-xl border border-blue-100 p-5">
                      <h2 className="font-bold text-blue-800 mb-2">🎯 Meta de Poupança</h2>
                      <p className="text-3xl font-bold text-blue-700">{analise.analise.metaPoupanca.percentual}%</p>
                      {analise.analise.metaPoupanca.valorMensal > 0 && (
                        <p className="text-blue-600 font-medium text-sm mt-1">
                          {formatarMoeda(analise.analise.metaPoupanca.valorMensal)}/mês
                        </p>
                      )}
                      <p className="text-blue-600 text-xs mt-2">{analise.analise.metaPoupanca.justificativa}</p>
                    </div>
                  )}
                </div>

                {analise.analise?.alertasCartao?.length > 0 && analise.analise.alertasCartao[0] && (
                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                    <h2 className="font-bold text-amber-800 mb-2">💳 Alertas de Cartão</h2>
                    <ul className="space-y-1">
                      {analise.analise.alertasCartao.map((a: string, i: number) => (
                        <li key={i} className="text-amber-700 text-sm flex gap-2">
                          <span>!</span> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analise.analise?.mensagem && (
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-5 text-white text-center">
                    <p className="italic">"{analise.analise.mensagem}"</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

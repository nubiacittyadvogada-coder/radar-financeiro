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

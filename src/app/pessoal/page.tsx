'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { formatarMoeda } from '@/lib/utils'

const CATEGORIAS_RECEITA = ['Salário', 'Freelance / Consultoria', 'Aluguel recebido', 'Investimentos', 'Outros']
const CATEGORIAS_DESPESA = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Vestuário', 'Serviços / Assinaturas', 'Impostos pessoais', 'Investimentos', 'Outros']
const CARTOES = ['Nubank', 'Inter', 'XP', 'Itaú', 'Bradesco', 'Santander', 'C6 Bank', 'Outro cartão']

const MESES_NOME = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_FULL = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function PessoalPage() {
  const router = useRouter()
  const [aba, setAba] = useState<'extrato' | 'cartoes' | 'analise'>('extrato')
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [transacoes, setTransacoes] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [analise, setAnalise] = useState<any>(null)
  const [loadingSetup, setLoadingSetup] = useState(true)
  const [loadingTransacoes, setLoadingTransacoes] = useState(false)
  const [loadingAnalise, setLoadingAnalise] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

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
          categoria: fTipo === 'receita' ? fCategoria : fCategoria,
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

  if (loadingSetup) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Carregando...</p></div>

  const cartaoTransacoes = transacoes.filter(t => t.grupoConta === 'pessoal_cartao')
  const cartoesUnicos = [...new Set(cartaoTransacoes.map(t => t.tipoContabil || 'Sem nome'))]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-700 text-sm">← Voltar</button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Finanças Pessoais</h1>
            <p className="text-sm text-gray-500">Controle sua vida financeira além da empresa</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={mes}
            onChange={e => setMes(+e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{MESES_FULL[i + 1]}</option>
            ))}
          </select>
          <select
            value={ano}
            onChange={e => setAno(+e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            {[2023, 2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </header>

      {/* Abas */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-1">
          {(['extrato', 'cartoes', 'analise'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setAba(tab)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                aba === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'extrato' ? '📊 Extrato' : tab === 'cartoes' ? '💳 Cartões' : '✦ Análise IA'}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{erro}</div>}
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
                  <p className="text-2xl font-bold text-red-700 mt-1">{formatarMoeda(stats.despesas)}</p>
                </div>
                <div className={`border rounded-xl p-4 ${stats.saldo >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                  <p className={`text-xs font-medium ${stats.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Saldo</p>
                  <p className={`text-2xl font-bold mt-1 ${stats.saldo >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{formatarMoeda(stats.saldo)}</p>
                </div>
              </div>
            )}

            {/* Botão + formulário */}
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-gray-700">
                Transações — {MESES_FULL[mes]} {ano}
                <span className="text-sm font-normal text-gray-400 ml-2">({transacoes.length})</span>
              </h2>
              <button
                onClick={() => setMostrarForm(!mostrarForm)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                + Adicionar
              </button>
            </div>

            {mostrarForm && (
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Nova Transação</h3>
                <form onSubmit={salvarTransacao} className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <div className="flex gap-2 mb-1">
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
                      placeholder={fTipo === 'receita' ? 'Ex: Salário março' : 'Ex: Mercado, Uber, Netflix...'}
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
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cartão de crédito (opcional)</label>
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
            ) : transacoes.length === 0 ? (
              <div className="bg-white rounded-xl border p-10 text-center">
                <p className="text-gray-400">Nenhuma transação em {MESES_FULL[mes]} {ano}</p>
                <button onClick={() => setMostrarForm(true)} className="mt-3 text-blue-600 text-sm hover:underline">
                  + Adicionar primeira transação
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border divide-y">
                {transacoes.map(t => (
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
            {stats?.porCategoria && Object.keys(stats.porCategoria).length > 0 && (
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-700 mb-3">Gastos por Categoria</h3>
                <div className="space-y-2">
                  {Object.entries(stats.porCategoria as Record<string, number>)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, val]) => {
                      const pct = stats.receitas > 0 ? (val / stats.receitas) * 100 : 0
                      return (
                        <div key={cat}>
                          <div className="flex justify-between text-sm mb-0.5">
                            <span className="text-gray-700">{cat}</span>
                            <span className="text-gray-500">{formatarMoeda(val)} <span className="text-xs text-gray-400">({pct.toFixed(0)}%)</span></span>
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

        {/* ===== ABA CARTÕES ===== */}
        {aba === 'cartoes' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-gray-700">Cartões de Crédito — {MESES_FULL[mes]} {ano}</h2>
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
                {/* Total cartões */}
                {stats?.cartao > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-purple-600 font-medium">Total gasto em cartões</p>
                      <p className="text-2xl font-bold text-purple-700">{formatarMoeda(stats.cartao)}</p>
                    </div>
                    {stats.receitas > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-purple-500">{((stats.cartao / stats.receitas) * 100).toFixed(1)}% da renda</p>
                        {stats.cartao / stats.receitas > 0.3 && (
                          <p className="text-xs text-red-500 font-medium mt-1">⚠ Alto uso do cartão</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Por cartão */}
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

                      {/* Categorias do cartão */}
                      <div className="space-y-1 mb-4">
                        {Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                          <div key={cat} className="flex justify-between text-sm text-gray-600">
                            <span>{cat}</span>
                            <span className="font-medium">{formatarMoeda(val)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Transações do cartão */}
                      <div className="border-t pt-3 space-y-1">
                        {gastoCartao.map(t => (
                          <div key={t.id} className="flex justify-between text-xs text-gray-500 py-1">
                            <span>{new Date(t.data).toLocaleDateString('pt-BR')} · {t.descricao}</span>
                            <span className="text-red-500 font-medium">-{formatarMoeda(Math.abs(Number(t.valor)))}</span>
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

                {/* Diagnóstico */}
                {analise.analise?.diagnostico && (
                  <div className="bg-white rounded-xl border p-6">
                    <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <span className="text-blue-600">◉</span> Diagnóstico
                    </h2>
                    <p className="text-gray-700 leading-relaxed">{analise.analise.diagnostico}</p>
                  </div>
                )}

                {/* Pontos críticos */}
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
                  {/* Dicas */}
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

                  {/* Meta poupança */}
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

                {/* Alertas cartão */}
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

                {/* Mensagem */}
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

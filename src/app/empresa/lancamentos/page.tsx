'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatarMoeda } from '@/lib/utils'

const MESES_FULL = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const CATS_RECEITA = [
  { value: 'honorario_inicial', label: 'Honorário Inicial', tipo: 'receita', planoConta: 'Honorários Iniciais' },
  { value: 'honorario_mensal', label: 'Honorário Mensal', tipo: 'receita', planoConta: 'Honorários Mensais' },
  { value: 'consulta', label: 'Consulta', tipo: 'receita', planoConta: 'Consultas' },
  { value: 'exito', label: 'Êxito', tipo: 'receita', planoConta: 'Honorário de Êxito' },
  { value: 'multa_cancelamento', label: 'Multa / Cancelamento', tipo: 'receita', planoConta: 'Multa Cancelamento' },
  { value: 'outros_receita', label: 'Outras receitas', tipo: 'receita', planoConta: 'Outros Recebimentos' },
]

const CATS_DESPESA = [
  { value: 'pessoal', label: 'Pessoal / Salários', tipo: 'pessoal', planoConta: 'Despesas com Pessoal' },
  { value: 'aluguel', label: 'Aluguel / Sede', tipo: 'geral', planoConta: 'Aluguel' },
  { value: 'marketing', label: 'Marketing / Publicidade', tipo: 'marketing', planoConta: 'Marketing' },
  { value: 'servicos', label: 'Serviços Externos', tipo: 'custo_direto', planoConta: 'Serviços Terceiros' },
  { value: 'software', label: 'Software / Assinaturas', tipo: 'geral', planoConta: 'Softwares e Sistemas' },
  { value: 'impostos', label: 'Impostos / Taxas', tipo: 'imposto', planoConta: 'Impostos e Taxas' },
  { value: 'retirada', label: 'Retirada de Sócio', tipo: 'retirada', planoConta: 'Retirada de Sócios' },
  { value: 'outras_despesas', label: 'Outras despesas', tipo: 'geral', planoConta: 'Despesas Gerais' },
]

type Lancamento = {
  id: string
  tipo: string
  subtipo: string | null
  planoConta: string
  favorecido: string | null
  descricao: string | null
  valor: string
  dataCompetencia: string | null
  statusPg: string | null
  origem: string
}

const hoje = new Date()

export default function EmpresaLancamentosPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [modal, setModal] = useState<'receita' | 'despesa' | null>(null)
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState({
    categoria: '',
    favorecido: '',
    descricao: '',
    valor: '',
    data: new Date().toISOString().slice(0, 10),
    pago: true,
    formaPagamento: '',
    observacoes: '',
  })

  useEffect(() => {
    const t = localStorage.getItem('radar_token')
    const u = localStorage.getItem('radar_usuario')
    if (!t || !u) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
  }, [router])

  const carregar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`/api/v2/empresa/lancamentos?mes=${mes}&ano=${ano}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setLancamentos(await res.json())
    } catch {} finally { setLoading(false) }
  }, [token, mes, ano])

  useEffect(() => { carregar() }, [carregar])

  function abrirModal(tipo: 'receita' | 'despesa') {
    setForm({ categoria: '', favorecido: '', descricao: '', valor: '', data: new Date().toISOString().slice(0, 10), pago: true, formaPagamento: '', observacoes: '' })
    setModal(tipo)
  }

  async function salvar() {
    if (!token || !form.categoria || !form.valor) return
    setSalvando(true)
    try {
      const cats = modal === 'receita' ? CATS_RECEITA : CATS_DESPESA
      const cat = cats.find(c => c.value === form.categoria)!
      await fetch('/api/v2/empresa/lancamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tipo: cat.tipo,
          subtipo: modal === 'receita' ? form.categoria : null,
          planoConta: cat.planoConta,
          grupoConta: modal === 'receita' ? 'Receitas' : 'Despesas',
          favorecido: form.favorecido || null,
          descricao: form.descricao || cat.label,
          valor: parseFloat(form.valor.replace(',', '.')),
          data: form.data,
          pago: form.pago,
          formaPagamento: form.formaPagamento || null,
          observacoes: form.observacoes || null,
        }),
      })
      setModal(null)
      carregar()
    } finally { setSalvando(false) }
  }

  async function excluir(id: string) {
    if (!token || !confirm('Excluir este lançamento?')) return
    await fetch(`/api/v2/empresa/lancamentos?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    carregar()
  }

  // KPIs
  const receitas = lancamentos.filter(l => l.tipo === 'receita')
  const despesas = lancamentos.filter(l => l.tipo !== 'receita')
  const totalReceitas = receitas.reduce((s, l) => s + Math.abs(Number(l.valor)), 0)
  const totalDespesas = despesas.reduce((s, l) => s + Math.abs(Number(l.valor)), 0)
  const resultado = totalReceitas - totalDespesas

  // Anos para seletor
  const anos = Array.from({ length: 3 }, (_, i) => hoje.getFullYear() - 1 + i)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 md:px-6 py-4">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">💰 Lançamentos</h1>
            <p className="text-sm text-gray-500 mt-0.5">Receitas e despesas do mês</p>
          </div>
          {/* Seletor de mês */}
          <div className="flex items-center gap-2">
            <select value={mes} onChange={e => setMes(+e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {MESES_FULL.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select value={ano} onChange={e => setAno(+e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {/* Botões */}
          <div className="flex gap-2">
            <button onClick={() => abrirModal('receita')} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              <span>+</span> Receita
            </button>
            <button onClick={() => abrirModal('despesa')} className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600">
              <span>+</span> Despesa
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 md:px-6 py-5 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
            <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Receitas</div>
            <div className="text-lg font-bold text-green-600">{formatarMoeda(totalReceitas)}</div>
            <div className="text-xs text-gray-400">{receitas.length} lançamento{receitas.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
            <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Despesas</div>
            <div className="text-lg font-bold text-red-500">{formatarMoeda(totalDespesas)}</div>
            <div className="text-xs text-gray-400">{despesas.length} lançamento{despesas.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
            <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Resultado</div>
            <div className={`text-lg font-bold ${resultado >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{formatarMoeda(resultado)}</div>
            <div className="text-xs text-gray-400">{resultado >= 0 ? 'Lucro' : 'Prejuízo'}</div>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Carregando...</div>
        ) : lancamentos.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center shadow-sm border">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-lg font-semibold text-gray-700">Nenhum lançamento em {MESES_FULL[mes]} {ano}</div>
            <div className="text-sm text-gray-400 mt-1 mb-4">Adicione receitas e despesas para acompanhar o resultado do mês.</div>
            <div className="flex justify-center gap-3">
              <button onClick={() => abrirModal('receita')} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">+ Receita</button>
              <button onClick={() => abrirModal('despesa')} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600">+ Despesa</button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {/* Receitas */}
            {receitas.length > 0 && (
              <>
                <div className="px-4 py-2.5 bg-green-50 border-b flex items-center justify-between">
                  <span className="text-sm font-semibold text-green-700">📈 Receitas</span>
                  <span className="text-sm font-bold text-green-700">{formatarMoeda(totalReceitas)}</span>
                </div>
                {receitas.map(l => (
                  <LancamentoRow key={l.id} l={l} onDelete={() => excluir(l.id)} />
                ))}
              </>
            )}
            {/* Despesas */}
            {despesas.length > 0 && (
              <>
                <div className={`px-4 py-2.5 bg-red-50 border-b flex items-center justify-between ${receitas.length > 0 ? 'border-t' : ''}`}>
                  <span className="text-sm font-semibold text-red-600">📉 Despesas</span>
                  <span className="text-sm font-bold text-red-600">{formatarMoeda(totalDespesas)}</span>
                </div>
                {despesas.map(l => (
                  <LancamentoRow key={l.id} l={l} onDelete={() => excluir(l.id)} />
                ))}
              </>
            )}
            {/* Rodapé resultado */}
            <div className={`px-4 py-3 border-t flex justify-between ${resultado >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
              <span className="text-sm font-bold text-gray-700">Resultado do mês</span>
              <span className={`text-sm font-bold ${resultado >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatarMoeda(resultado)}</span>
            </div>
          </div>
        )}
      </main>

      {/* Modal Receita / Despesa */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className={`text-base font-semibold ${modal === 'receita' ? 'text-green-700' : 'text-red-600'}`}>
                {modal === 'receita' ? '📈 Nova Receita' : '📉 Nova Despesa'}
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {/* Categoria */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Categoria *</label>
              <select
                value={form.categoria}
                onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${modal === 'receita' ? 'focus:ring-green-400' : 'focus:ring-red-400'}`}
              >
                <option value="">Selecione...</option>
                {(modal === 'receita' ? CATS_RECEITA : CATS_DESPESA).map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Cliente/Favorecido */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                {modal === 'receita' ? 'Cliente / Origem' : 'Fornecedor / Favorecido'}
              </label>
              <input
                type="text"
                placeholder={modal === 'receita' ? 'Ex: João Silva' : 'Ex: Conta de Luz'}
                value={form.favorecido}
                onChange={e => setForm(p => ({ ...p, favorecido: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Descrição</label>
              <input
                type="text"
                placeholder="Ex: Honorário processo nº 123"
                value={form.descricao}
                onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Valor + Data */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Valor (R$) *</label>
                <input
                  type="text"
                  placeholder="Ex: 3500"
                  value={form.valor}
                  onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Data</label>
                <input
                  type="date"
                  value={form.data}
                  onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Já pago / recebido */}
            <div className="flex items-center gap-3 py-1">
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, pago: !p.pago }))}
                className={`w-11 h-6 rounded-full transition-colors relative ${form.pago ? (modal === 'receita' ? 'bg-green-500' : 'bg-blue-500') : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.pago ? 'left-5' : 'left-0.5'}`} />
              </button>
              <span className="text-sm text-gray-600">
                {modal === 'receita' ? 'Já recebido' : 'Já pago'}
              </span>
            </div>

            {/* Observações */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Observações</label>
              <input
                type="text"
                placeholder="Opcional"
                value={form.observacoes}
                onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando || !form.categoria || !form.valor}
                className={`flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${modal === 'receita' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}
              >
                {salvando ? 'Salvando...' : `Salvar ${modal === 'receita' ? 'receita' : 'despesa'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LancamentoRow({ l, onDelete }: { l: Lancamento; onDelete: () => void }) {
  const isReceita = l.tipo === 'receita'
  const data = l.dataCompetencia ? new Date(l.dataCompetencia).toLocaleDateString('pt-BR') : '—'
  const pago = l.statusPg === 'pago'

  return (
    <div className="px-4 py-3 flex items-center gap-3 border-b last:border-b-0 hover:bg-gray-50">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm ${isReceita ? 'bg-green-100' : 'bg-red-100'}`}>
        {isReceita ? '↑' : '↓'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">
          {l.favorecido || l.descricao || l.planoConta}
        </div>
        <div className="text-xs text-gray-400 flex items-center gap-2">
          <span>{l.planoConta}</span>
          <span>·</span>
          <span>{data}</span>
          {l.origem === 'manual' && <span className="text-blue-400">manual</span>}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-sm font-bold ${isReceita ? 'text-green-600' : 'text-red-500'}`}>
          {isReceita ? '+' : '-'}{formatarMoeda(Math.abs(Number(l.valor)))}
        </div>
        <div className={`text-xs ${pago ? 'text-green-500' : 'text-amber-500'}`}>
          {pago ? '● pago' : '○ pendente'}
        </div>
      </div>
      {l.origem === 'manual' && (
        <button onClick={onDelete} className="text-gray-300 hover:text-red-400 text-sm flex-shrink-0 ml-1">✕</button>
      )}
    </div>
  )
}

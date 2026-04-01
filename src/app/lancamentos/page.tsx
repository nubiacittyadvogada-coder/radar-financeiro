'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { formatarMoeda } from '@/lib/utils'

const CATEGORIAS_RECEITA = [
  { label: 'Honorários Iniciais', planoConta: '01_RPS.HONORARIOS INICIAIS' },
  { label: 'Honorários Mensais', planoConta: '01_RPS.HONORARIOS MENSAIS' },
  { label: 'Honorários de Êxito', planoConta: '01_RPS.HONORARIOS DE EXITO' },
  { label: 'Consulta', planoConta: '01_RPS.CONSULTA' },
  { label: 'Multa / Cancelamento', planoConta: '01_RPS.MULTA CANCELAMENTO' },
  { label: 'Outros (Receita)', planoConta: '01_RPS.OUTROS' },
]

const CATEGORIAS_DESPESA = [
  { label: 'Salários / Pessoal', planoConta: '04_PES.SALARIOS' },
  { label: 'Pró-labore / Retirada', planoConta: '05_RET.RETIRADA' },
  { label: 'Marketing / Publicidade', planoConta: '04_MKT.PUBLICIDADE' },
  { label: 'Aluguel', planoConta: '04_GER.ALUGUEL' },
  { label: 'Software / Sistemas', planoConta: '04_GER.SISTEMAS' },
  { label: 'Custos Processuais', planoConta: '03_CSP.CUSTOS PROCESSUAIS' },
  { label: 'Impostos / Simples', planoConta: '02_IMP.SIMPLES NACIONAL' },
  { label: 'Despesas Bancárias', planoConta: '04_GER.DESPESAS BANCARIAS' },
  { label: 'Telefone / Internet', planoConta: '04_GER.TELEFONE' },
  { label: 'Outras Despesas', planoConta: '04_GER.OUTROS' },
]

const MESES_NOME = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function LancamentosPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<any>(null)
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const hoje = new Date()
  const [filtroMes, setFiltroMes] = useState(hoje.getMonth() + 1)
  const [filtroAno, setFiltroAno] = useState(hoje.getFullYear())

  // Formulário
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('receita')
  const [descricao, setDescricao] = useState('')
  const [favorecido, setFavorecido] = useState('')
  const [planoConta, setPlanoConta] = useState(CATEGORIAS_RECEITA[0].planoConta)
  const [valor, setValor] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [previsto, setPrevisto] = useState(false)
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    if (!u) { router.push('/login'); return }
    setUsuario(JSON.parse(u))
  }, [router])

  useEffect(() => {
    if (usuario) carregarLancamentos()
  }, [usuario, filtroMes, filtroAno])

  // Atualizar planoConta padrão quando muda tipo
  useEffect(() => {
    if (tipo === 'receita') setPlanoConta(CATEGORIAS_RECEITA[0].planoConta)
    else setPlanoConta(CATEGORIAS_DESPESA[0].planoConta)
  }, [tipo])

  async function carregarLancamentos() {
    setLoading(true)
    try {
      const clienteId = usuario.tipo === 'cliente' ? undefined : undefined
      const data = await api.getLancamentos(clienteId, filtroMes, filtroAno)
      setLancamentos(data || [])
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!descricao || !valor || !data || !planoConta) {
      setErro('Preencha todos os campos obrigatórios.')
      return
    }

    setSalvando(true)
    setErro('')
    setSucesso('')
    try {
      await api.criarLancamento({
        tipo,
        descricao,
        favorecido: favorecido || undefined,
        planoConta,
        valor: parseFloat(valor.replace(',', '.')),
        data,
        previsto,
        observacoes: observacoes || undefined,
      })
      setSucesso('Lançamento salvo! O fechamento do mês foi atualizado.')
      setDescricao('')
      setFavorecido('')
      setValor('')
      setObservacoes('')
      setPrevisto(false)
      carregarLancamentos()
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string) {
    if (!confirm('Remover este lançamento?')) return
    try {
      await api.deletarLancamento(id)
      carregarLancamentos()
    } catch (e: any) {
      setErro(e.message)
    }
  }

  const categorias = tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA
  const totalReceitas = lancamentos.filter(l => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0)
  const totalDespesas = lancamentos.filter(l => l.tipo !== 'receita').reduce((s, l) => s + Number(l.valor), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lançamentos Manuais</h1>
          <p className="text-sm text-gray-500">Adicione receitas e despesas diretamente</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push('/contas')} className="px-3 py-2 text-sm bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 font-medium">
            📋 Contas a Pagar
          </button>
          <button onClick={() => router.push('/dashboard')} className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            ← Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Formulário */}
        <div className="bg-white rounded-xl shadow-sm p-6 border h-fit">
          <h2 className="text-lg font-semibold text-gray-800 mb-5">Novo Lançamento</h2>

          {erro && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{erro}</div>}
          {sucesso && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{sucesso}</div>}

          <form onSubmit={salvar} className="space-y-4">
            {/* Tipo */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipo('receita')}
                className={`py-3 rounded-lg text-sm font-semibold border-2 transition-colors ${
                  tipo === 'receita'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
                }`}
              >
                ↑ Receita
              </button>
              <button
                type="button"
                onClick={() => setTipo('despesa')}
                className={`py-3 rounded-lg text-sm font-semibold border-2 transition-colors ${
                  tipo === 'despesa'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'
                }`}
              >
                ↓ Despesa
              </button>
            </div>

            {/* Categoria */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
              <select
                value={planoConta}
                onChange={(e) => setPlanoConta(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {categorias.map((c) => (
                  <option key={c.planoConta} value={c.planoConta}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tipo === 'receita' ? 'Descrição / Cliente *' : 'Descrição *'}
              </label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder={tipo === 'receita' ? 'Ex: Honorário inicial — João Silva' : 'Ex: Aluguel março'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Favorecido */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tipo === 'receita' ? 'Nome do Cliente' : 'Fornecedor / Beneficiário'}
              </label>
              <input
                type="text"
                value={favorecido}
                onChange={(e) => setFavorecido(e.target.value)}
                placeholder={tipo === 'receita' ? 'Nome do cliente' : 'Nome do fornecedor'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Valor e Data */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {tipo === 'receita' ? 'Data Recebimento *' : 'Data Pagamento *'}
                </label>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <input
                type="text"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Previsto */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={previsto}
                onChange={(e) => setPrevisto(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-600">Ainda não foi {tipo === 'receita' ? 'recebido' : 'pago'} (previsto)</span>
            </label>

            <button
              type="submit"
              disabled={salvando}
              className={`w-full py-3 rounded-lg text-white font-semibold transition-colors ${
                tipo === 'receita'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              } disabled:opacity-50`}
            >
              {salvando ? 'Salvando...' : `Adicionar ${tipo === 'receita' ? 'Receita' : 'Despesa'}`}
            </button>
          </form>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Lançamentos Registrados</h2>
            <select
              value={`${filtroMes}-${filtroAno}`}
              onChange={(e) => {
                const [m, a] = e.target.value.split('-')
                setFiltroMes(+m)
                setFiltroAno(+a)
              }}
              className="px-2 py-1 border rounded text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const m = i + 1
                return <option key={m} value={`${m}-${filtroAno}`}>{MESES_NOME[m]}/{filtroAno}</option>
              })}
            </select>
          </div>

          {/* Totais */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xs text-green-600 font-medium">Receitas</p>
              <p className="text-lg font-bold text-green-700">{formatarMoeda(totalReceitas)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-xs text-red-600 font-medium">Despesas</p>
              <p className="text-lg font-bold text-red-700">{formatarMoeda(totalDespesas)}</p>
            </div>
          </div>

          {loading ? (
            <p className="text-center text-gray-400 py-8">Carregando...</p>
          ) : lancamentos.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Nenhum lançamento em {MESES_NOME[filtroMes]}/{filtroAno}</p>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {lancamentos.map((l) => {
                const isReceita = l.tipo === 'receita'
                const cat = isReceita
                  ? CATEGORIAS_RECEITA.find(c => c.planoConta === l.planoConta)?.label
                  : CATEGORIAS_DESPESA.find(c => c.planoConta === l.planoConta)?.label
                const dataFmt = new Date(l.data).toLocaleDateString('pt-BR')
                return (
                  <div key={l.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className={`text-lg ${isReceita ? 'text-green-500' : 'text-red-500'}`}>
                        {isReceita ? '↑' : '↓'}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{l.descricao}</p>
                        <p className="text-xs text-gray-400">{cat || l.planoConta} · {dataFmt}{l.previsto ? ' · PREVISTO' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold ${isReceita ? 'text-green-600' : 'text-red-600'}`}>
                        {formatarMoeda(Number(l.valor))}
                      </span>
                      <button
                        onClick={() => excluir(l.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors text-sm"
                        title="Remover"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

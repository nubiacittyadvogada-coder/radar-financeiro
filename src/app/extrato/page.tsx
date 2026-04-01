'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { formatarMoeda } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const BANCOS = [
  { value: 'ofx', label: '🏦 OFX / OFXBANK (BB, Itaú, Sicredi e outros)', ext: '.ofx' },
  { value: 'bb', label: '🟡 Banco do Brasil — CSV', ext: '.csv' },
  { value: 'itau', label: '🟠 Itaú — CSV', ext: '.csv' },
  { value: 'sicredi', label: '🟢 Sicredi — CSV', ext: '.csv' },
]

const CATEGORIAS_LABEL: Record<string, string> = {
  '01_RPS': '💰 Receita',
  '02_IMP': '📊 Imposto',
  '03_CSP': '🔧 Custo Direto',
  '04_PES': '👥 Pessoal',
  '04_MKT': '📢 Marketing',
  '04_GER': '🏢 Despesa Geral',
  '05_RET': '💸 Retirada',
  '06_DRF': '🏦 Financeiro',
  '08_INV': '📈 Investimento',
  '09_EMP': '🏦 Empréstimo',
}

const PLANOS_OPCOES = [
  { value: '01_RPS.HONORARIOS MENSAIS', label: '💰 Mensalidade / Monitoramento' },
  { value: '01_RPS.INSTALACAO', label: '💰 Instalação de Equipamentos' },
  { value: '01_RPS.MANUTENCAO', label: '💰 Manutenção Técnica' },
  { value: '01_RPS.OUTROS', label: '💰 Outras Receitas' },
  { value: '02_IMP.SIMPLES NACIONAL', label: '📊 Simples Nacional / DAS' },
  { value: '03_CSP.EQUIPAMENTOS', label: '🔧 Equipamentos / Materiais' },
  { value: '03_CSP.MAO DE OBRA', label: '🔧 Mão de Obra / Técnicos' },
  { value: '04_PES.SALARIOS', label: '👥 Salários / Pessoal' },
  { value: '04_MKT.PUBLICIDADE', label: '📢 Marketing / Publicidade' },
  { value: '04_GER.ALUGUEL', label: '🏢 Aluguel' },
  { value: '04_GER.COMBUSTIVEL', label: '⛽ Combustível' },
  { value: '04_GER.TELEFONE', label: '📱 Telefone / Internet' },
  { value: '04_GER.SISTEMAS', label: '💻 Softwares / Sistemas' },
  { value: '04_GER.DESPESAS BANCARIAS', label: '🏦 Taxas Bancárias' },
  { value: '04_GER.VEICULOS', label: '🚗 Veículos / IPVA' },
  { value: '04_GER.OUTROS', label: '🏢 Outras Despesas' },
  { value: '05_RET.RETIRADA', label: '💸 Retirada de Sócios' },
  { value: '06_DRF.JUROS PAGOS', label: '🏦 Juros Pagos' },
  { value: '06_DRF.RECEITA JUROS', label: '🏦 Rendimento / Aplicação' },
  { value: 'IGNORAR', label: '🚫 Ignorar (transferência interna)' },
]

export default function ExtratoPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [banco, setBanco] = useState('ofx')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [etapa, setEtapa] = useState<'upload' | 'preview' | 'sucesso'>('upload')
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [transacoes, setTransacoes] = useState<any[]>([])
  const [resultado, setResultado] = useState<any>(null)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    if (!u) { router.push('/login'); return }
    setUsuario(JSON.parse(u))
  }, [router])

  async function analisar(e: React.FormEvent) {
    e.preventDefault()
    if (!arquivo) { setErro('Selecione um arquivo'); return }

    setCarregando(true)
    setErro('')
    try {
      const token = localStorage.getItem('radar_token')
      const formData = new FormData()
      formData.append('arquivo', arquivo)
      formData.append('banco', banco)

      const res = await fetch(`${API_URL}/api/extrato/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro || 'Erro ao processar')

      setTransacoes(data.transacoes)
      setEtapa('preview')
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  async function confirmar() {
    setSalvando(true)
    setErro('')
    try {
      const token = localStorage.getItem('radar_token')
      const res = await fetch(`${API_URL}/api/extrato/confirmar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ transacoes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro || 'Erro ao salvar')
      setResultado(data)
      setEtapa('sucesso')
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  function alterarCategoria(idx: number, planoConta: string) {
    const novas = [...transacoes]
    const t = { ...novas[idx] }
    if (planoConta === 'IGNORAR') {
      t.ignorar = true
      t.planoConta = 'IGNORAR'
    } else {
      t.ignorar = false
      t.planoConta = planoConta
      t.grupoConta = planoConta.split('.')[0]
      const TIPO_MAP: Record<string, string> = {
        '01_RPS': 'receita', '02_IMP': 'imposto', '03_CSP': 'custo_direto',
        '04_PES': 'pessoal', '04_MKT': 'marketing', '04_GER': 'geral',
        '05_RET': 'retirada', '06_DRF': 'financeiro',
      }
      t.tipoContabil = TIPO_MAP[t.grupoConta] || 'geral'
    }
    novas[idx] = t
    setTransacoes(novas)
  }

  function toggleIgnorar(idx: number) {
    const novas = [...transacoes]
    novas[idx] = { ...novas[idx], ignorar: !novas[idx].ignorar }
    setTransacoes(novas)
  }

  const paraLancar = transacoes.filter(t => !t.ignorar)
  const totalCreditos = paraLancar.filter(t => t.tipo === 'credito').reduce((s, t) => s + t.valor, 0)
  const totalDebitos = paraLancar.filter(t => t.tipo === 'debito').reduce((s, t) => s + t.valor, 0)

  if (etapa === 'sucesso') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl p-10 shadow text-center max-w-md">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Extrato importado!</h2>
          <p className="text-gray-500 mb-6">
            <strong>{resultado?.salvos}</strong> lançamentos salvos
            {resultado?.ignorados > 0 && ` · ${resultado.ignorados} ignorados`}
            {resultado?.mesesAtualizados?.length > 0 && `. Fechamento atualizado para: ${resultado.mesesAtualizados.join(', ')}`}
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push('/dashboard')} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
              Ver Dashboard
            </button>
            <button onClick={() => { setEtapa('upload'); setTransacoes([]); setArquivo(null) }} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
              Importar outro
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Importar Extrato Bancário</h1>
          <p className="text-sm text-gray-500">A IA categoriza cada transação automaticamente</p>
        </div>
        <button onClick={() => router.push('/dashboard')} className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
          ← Dashboard
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {etapa === 'upload' && (
          <div className="bg-white rounded-xl shadow-sm p-8 border max-w-xl mx-auto">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Como exportar o extrato?</h2>

            <div className="bg-blue-50 rounded-lg p-4 mb-6 text-sm text-blue-800 space-y-1">
              <p><strong>Banco do Brasil:</strong> Internet Banking → Extrato → Exportar → OFX</p>
              <p><strong>Itaú:</strong> App/Site → Extrato → Exportar → OFX ou CSV</p>
              <p><strong>Sicredi:</strong> Internet Banking → Extrato → Exportar → OFX</p>
            </div>

            {erro && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{erro}</div>}

            <form onSubmit={analisar} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Banco / Formato</label>
                <div className="space-y-2">
                  {BANCOS.map(b => (
                    <label key={b.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${banco === b.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="banco" value={b.value} checked={banco === b.value} onChange={() => setBanco(b.value)} className="text-blue-600" />
                      <span className="text-sm">{b.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Arquivo do Extrato</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${arquivo ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}
                >
                  {arquivo ? (
                    <div>
                      <p className="text-green-600 font-medium">✅ {arquivo.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{(arquivo.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-4xl mb-2">📄</p>
                      <p className="text-gray-500 font-medium">Clique para selecionar</p>
                      <p className="text-xs text-gray-400 mt-1">OFX, CSV ou TXT</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".ofx,.csv,.txt"
                  className="hidden"
                  onChange={e => setArquivo(e.target.files?.[0] || null)}
                />
              </div>

              <button
                type="submit"
                disabled={carregando || !arquivo}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {carregando ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Analisando com IA...
                  </span>
                ) : '🤖 Analisar com IA'}
              </button>
            </form>
          </div>
        )}

        {etapa === 'preview' && (
          <div className="space-y-4">
            {/* Resumo */}
            <div className="bg-white rounded-xl p-5 border shadow-sm grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500">Total de transações</p>
                <p className="text-2xl font-bold text-gray-800">{transacoes.length}</p>
              </div>
              <div>
                <p className="text-xs text-green-600">Créditos (receitas)</p>
                <p className="text-xl font-bold text-green-600">{formatarMoeda(totalCreditos)}</p>
              </div>
              <div>
                <p className="text-xs text-red-600">Débitos (despesas)</p>
                <p className="text-xl font-bold text-red-600">{formatarMoeda(totalDebitos)}</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
              💡 <strong>Revise as categorias abaixo.</strong> A IA categoriza automaticamente — ajuste o que precisar antes de confirmar. Clique em <strong>Ignorar</strong> para transferências entre suas próprias contas.
            </div>

            {erro && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{erro}</div>}

            {/* Tabela de transações */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Data</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Descrição</th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">Valor</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Categoria</th>
                    <th className="text-center px-4 py-3 text-gray-600 font-medium">Ignorar</th>
                  </tr>
                </thead>
                <tbody>
                  {transacoes.map((t, i) => (
                    <tr key={i} className={`border-b ${t.ignorar ? 'opacity-40 bg-gray-50' : ''}`}>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                        {new Date(t.data).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-2.5 text-gray-800 max-w-xs">
                        <p className="truncate">{t.descricao}</p>
                        {t.confianca === 'baixa' && !t.ignorar && (
                          <span className="text-xs text-yellow-600">⚠️ Verifique</span>
                        )}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-semibold whitespace-nowrap ${t.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.tipo === 'credito' ? '+' : '-'}{formatarMoeda(t.valor)}
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={t.ignorar ? 'IGNORAR' : t.planoConta}
                          onChange={e => alterarCategoria(i, e.target.value)}
                          className="text-xs border border-gray-200 rounded px-2 py-1 w-full max-w-[220px] bg-white"
                        >
                          {PLANOS_OPCOES.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={t.ignorar}
                          onChange={() => toggleIgnorar(i)}
                          className="w-4 h-4 text-gray-400 rounded"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Botões de ação */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setEtapa('upload'); setTransacoes([]) }}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
              >
                ← Voltar
              </button>
              <button
                onClick={confirmar}
                disabled={salvando || paraLancar.length === 0}
                className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : `✅ Confirmar e salvar ${paraLancar.length} lançamentos`}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

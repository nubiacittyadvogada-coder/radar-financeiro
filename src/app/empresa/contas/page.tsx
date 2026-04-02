'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { formatarMoeda } from '@/lib/utils'

type Conta = {
  id: string
  descricao: string
  fornecedor?: string
  valor: number
  vencimento: string
  status: string
  categoria?: string
  recorrente: boolean
  pagoEm?: string
}

function excelSerialToISO(serial: number): string {
  const d = new Date((serial - 25569) * 86400 * 1000)
  return d.toISOString().slice(0, 10)
}

export default function EmpresaContasPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todas' | 'pendente' | 'pago' | 'atrasado'>('pendente')
  const [showForm, setShowForm] = useState(false)
  const [processando, setProcessando] = useState<string | null>(null)
  const [previewContas, setPreviewContas] = useState<any[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    descricao: '', fornecedor: '', valor: '', vencimento: '', categoria: '', recorrente: false,
  })

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
    carregarContas(t)
  }, [router])

  async function carregarContas(t: string) {
    setLoading(true)
    const res = await fetch('/api/v2/empresa/contas', { headers: { Authorization: `Bearer ${t}` } })
    if (res.ok) {
      // Atualiza status: se vencimento < hoje e pendente => atrasado
      const data: Conta[] = await res.json()
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      setContas(data.map((c) => ({
        ...c,
        status: c.status === 'pendente' && new Date(c.vencimento) < hoje ? 'atrasado' : c.status,
      })))
    }
    setLoading(false)
  }

  async function pagar(id: string) {
    if (!token) return
    setProcessando(id)
    await fetch(`/api/v2/empresa/contas/${id}/pagar`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } })
    await carregarContas(token)
    setProcessando(null)
  }

  async function adicionarConta() {
    if (!token || !form.descricao || !form.valor || !form.vencimento) return
    const res = await fetch('/api/v2/empresa/contas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, valor: Number(form.valor) }),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ descricao: '', fornecedor: '', valor: '', vencimento: '', categoria: '', recorrente: false })
      carregarContas(token)
    }
  }

  async function lerExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })

    let sheetName = wb.SheetNames[0]
    for (const name of wb.SheetNames) {
      if (name.toLowerCase().includes('contas a pagar') || name.toLowerCase().includes('relatorio')) {
        sheetName = name; break
      }
    }

    const ws = wb.Sheets[sheetName]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    let headerIdx = -1
    let colMap: Record<string, number> = {}
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const row = rows[i].map((c: any) => String(c).toUpperCase())
      if (row.some((c) => c.includes('FAVORECIDO') || c.includes('DESCRICAO') || c.includes('DESCRIÇÃO'))) {
        headerIdx = i
        row.forEach((col, idx) => {
          if (col.includes('FAVORECIDO')) colMap.favorecido = idx
          if (col.includes('DESCRICAO') || col.includes('DESCRIÇÃO')) colMap.descricao = idx
          if (col.includes('VALOR')) colMap.valor = idx
          if (col.includes('VENC') && !col.includes('VENCER')) colMap.vencimento = idx
          if (col === 'PG' || col.includes('STATUS') || col.includes('SITUACAO')) colMap.pg = idx
        })
        break
      }
    }

    if (headerIdx === -1) { alert('Cabeçalho não encontrado'); return }

    const lista: any[] = []
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i]
      const pg = String(row[colMap.pg] || '').toUpperCase().trim()
      if (pg === 'PG' || pg === 'PAGO') continue
      const vencRaw = row[colMap.vencimento]
      let vencimento = ''
      if (typeof vencRaw === 'number') vencimento = excelSerialToISO(vencRaw)
      else if (vencRaw) vencimento = String(vencRaw)
      if (!vencimento) continue
      const valorRaw = row[colMap.valor]
      const valor = typeof valorRaw === 'number' ? valorRaw : parseFloat(String(valorRaw).replace(',', '.')) || 0
      if (valor === 0) continue
      const descricao = String(row[colMap.descricao] || row[colMap.favorecido] || '').trim()
      if (!descricao) continue
      lista.push({
        descricao,
        fornecedor: row[colMap.favorecido] ? String(row[colMap.favorecido]).trim() : null,
        valor: Math.abs(valor),
        vencimento,
      })
    }

    setPreviewContas(lista)
    setSelecionadas(new Set(lista.map((_, i) => i)))
    setShowPreview(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function confirmarImport() {
    if (!token) return
    const selecionadasLista = previewContas.filter((_, i) => selecionadas.has(i))
    const res = await fetch('/api/v2/empresa/contas/importar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ contas: selecionadasLista }),
    })
    const data = await res.json()
    if (res.ok) {
      setShowPreview(false)
      setPreviewContas([])
      alert(`${data.total} contas importadas!`)
      carregarContas(token)
    }
  }

  const contasFiltradas = contas.filter((c) => filtro === 'todas' || c.status === filtro)
  const totalPendente = contas.filter((c) => c.status === 'pendente' || c.status === 'atrasado').reduce((s, c) => s + Number(c.valor), 0)
  const qtdAtrasadas = contas.filter((c) => c.status === 'atrasado').length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Contas a Pagar</h1>
            <p className="text-sm text-gray-500">
              {formatarMoeda(totalPendente)} pendente
              {qtdAtrasadas > 0 && <span className="ml-2 text-red-500">{qtdAtrasadas} atrasada(s)</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
            >
              📂 Importar Excel
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              + Nova conta
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={lerExcel} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Filtros */}
        <div className="flex gap-2 mb-6">
          {(['todas', 'pendente', 'atrasado', 'pago'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                filtro === f ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'todas' ? 'Todas' : f === 'pendente' ? 'Pendentes' : f === 'atrasado' ? 'Atrasadas' : 'Pagas'}
            </button>
          ))}
        </div>

        {/* Preview modal importação */}
        {showPreview && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-auto">
            <div className="bg-white rounded-2xl w-full max-w-2xl mt-10 shadow-2xl">
              <div className="p-5 border-b flex justify-between">
                <h2 className="font-bold">Prévia da importação ({previewContas.length} contas)</h2>
                <div className="flex gap-2">
                  <button onClick={() => setSelecionadas(new Set(previewContas.map((_, i) => i)))} className="text-xs text-blue-600">Todas</button>
                  <button onClick={() => setSelecionadas(new Set())} className="text-xs text-gray-400">Nenhuma</button>
                </div>
              </div>
              <div className="max-h-96 overflow-auto p-4 space-y-2">
                {previewContas.map((c, i) => (
                  <label key={i} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selecionadas.has(i)}
                      onChange={(e) => {
                        const s = new Set(selecionadas)
                        e.target.checked ? s.add(i) : s.delete(i)
                        setSelecionadas(s)
                      }}
                    />
                    <span className="flex-1 text-sm">{c.descricao}</span>
                    <span className="text-sm font-medium text-gray-700">{formatarMoeda(c.valor)}</span>
                    <span className="text-xs text-gray-400">{new Date(c.vencimento).toLocaleDateString('pt-BR')}</span>
                  </label>
                ))}
              </div>
              <div className="p-4 border-t flex justify-between items-center">
                <span className="text-sm text-gray-500">{selecionadas.size} selecionada(s)</span>
                <div className="flex gap-3">
                  <button onClick={() => setShowPreview(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600">Cancelar</button>
                  <button onClick={confirmarImport} disabled={selecionadas.size === 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    Importar {selecionadas.size}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form nova conta */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h2 className="font-bold mb-4">Nova conta a pagar</h2>
              <div className="space-y-3">
                <input placeholder="Descrição *" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                <input placeholder="Fornecedor" value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Valor *" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  <input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600">Cancelar</button>
                <button onClick={adicionarConta} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Salvar</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando...</div>
        ) : contasFiltradas.length === 0 ? (
          <div className="text-center py-20 text-gray-400">Nenhuma conta encontrada.</div>
        ) : (
          <div className="space-y-2">
            {contasFiltradas.map((c) => (
              <div key={c.id} className={`bg-white rounded-xl px-5 py-4 shadow-sm border flex items-center justify-between ${c.status === 'atrasado' ? 'border-red-200' : ''}`}>
                <div>
                  <div className="font-medium text-gray-900 text-sm">{c.descricao}</div>
                  {c.fornecedor && <div className="text-xs text-gray-400">{c.fornecedor}</div>}
                  <div className="text-xs text-gray-500 mt-0.5">
                    Venc.: {new Date(c.vencimento).toLocaleDateString('pt-BR')}
                    {c.status === 'atrasado' && <span className="ml-2 text-red-500 font-medium">ATRASADA</span>}
                    {c.status === 'pago' && c.pagoEm && <span className="ml-2 text-green-600">Pago em {new Date(c.pagoEm).toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-bold ${c.status === 'atrasado' ? 'text-red-500' : c.status === 'pago' ? 'text-green-600' : 'text-gray-800'}`}>
                    {formatarMoeda(c.valor)}
                  </span>
                  {c.status !== 'pago' && (
                    <button
                      onClick={() => pagar(c.id)}
                      disabled={processando === c.id}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      {processando === c.id ? '...' : 'Pagar'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

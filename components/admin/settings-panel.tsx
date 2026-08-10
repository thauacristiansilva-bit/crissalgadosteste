"use client"

import { FormEvent, useState } from "react"
import { Clock3, Save, Store } from "lucide-react"
import type { BusinessHour, Courier, DeliveryZone, StoreSettings } from "@/lib/types"
import { DeliverySettings } from "@/components/admin/delivery-settings"

export function SettingsPanel({
  settings,
  deliveryZones,
  couriers,
  onSettingsChanged,
  onDeliveryZonesChanged,
  onCouriersChanged,
}: {
  settings: StoreSettings
  deliveryZones: DeliveryZone[]
  couriers: Courier[]
  onSettingsChanged: (settings: StoreSettings) => void
  onDeliveryZonesChanged: (zones: DeliveryZone[]) => void
  onCouriersChanged: (couriers: Courier[]) => void
}) {
  const [draft, setDraft] = useState(settings)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage("")
    try {
      const response = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar.")
      setDraft(data.settings)
      onSettingsChanged(data.settings)
      setMessage("Configurações salvas.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar.")
    } finally {
      setBusy(false)
    }
  }

  function updateDay(day: number, patch: Partial<BusinessHour>) {
    setDraft((current) => ({ ...current, businessHours: current.businessHours.map((item) => item.day === day ? { ...item, ...patch } : item) }))
  }

  const input = "h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <form onSubmit={submit} className="space-y-5">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Store className="h-5 w-5" /></div><div><h2 className="text-lg font-bold text-gray-900">Dados da loja</h2><p className="text-sm text-gray-500">Informações exibidas no site e posição inicial do mapa.</p></div></div>
          <div className="grid gap-4 md:grid-cols-2"><label><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Nome</span><input className={input} value={draft.storeName} onChange={(e)=>setDraft({...draft,storeName:e.target.value})}/></label><label><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Slogan</span><input className={input} value={draft.slogan} onChange={(e)=>setDraft({...draft,slogan:e.target.value})}/></label><label><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Telefone</span><input className={input} value={draft.phone} onChange={(e)=>setDraft({...draft,phone:e.target.value})}/></label><label><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">WhatsApp com DDI</span><input className={input} value={draft.whatsapp} onChange={(e)=>setDraft({...draft,whatsapp:e.target.value})}/></label><label className="md:col-span-2"><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Endereço</span><input className={input} value={draft.address} onChange={(e)=>setDraft({...draft,address:e.target.value})}/></label><label><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Cidade</span><input className={input} value={draft.city} onChange={(e)=>setDraft({...draft,city:e.target.value})}/></label><label><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Estado</span><input className={input} value={draft.state} onChange={(e)=>setDraft({...draft,state:e.target.value})}/></label><label><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">CEP</span><input className={input} value={draft.zipCode} onChange={(e)=>setDraft({...draft,zipCode:e.target.value})}/></label><label><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Texto do horário</span><input className={input} value={draft.openingHours} onChange={(e)=>setDraft({...draft,openingHours:e.target.value})}/></label><label><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Latitude da loja</span><input type="number" step="0.000001" className={input} value={draft.storeLatitude} onChange={(e)=>setDraft({...draft,storeLatitude:Number(e.target.value)})}/></label><label><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Longitude da loja</span><input type="number" step="0.000001" className={input} value={draft.storeLongitude} onChange={(e)=>setDraft({...draft,storeLongitude:Number(e.target.value)})}/></label></div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><Clock3 className="h-5 w-5" /></div><div><h2 className="text-lg font-bold text-gray-900">Horários e agendamento</h2><p className="text-sm text-gray-500">Pedidos feitos durante o expediente são aceitos automaticamente. O cliente escolhe o horário de recebimento.</p></div></div>
          <div className="space-y-2">{draft.businessHours.map((item) => <div key={item.day} className="grid items-center gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-[120px_1fr_1fr_auto]"><label className="flex items-center gap-2 text-sm font-bold text-gray-800"><input type="checkbox" checked={item.enabled} onChange={(e)=>updateDay(item.day,{enabled:e.target.checked})} className="h-5 w-5" />{item.label}</label><label><span className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Abre</span><input type="time" disabled={!item.enabled} className={input} value={item.open} onChange={(e)=>updateDay(item.day,{open:e.target.value})}/></label><label><span className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Fecha</span><input type="time" disabled={!item.enabled} className={input} value={item.close} onChange={(e)=>updateDay(item.day,{close:e.target.value})}/></label><span className={`rounded-full px-2.5 py-1 text-center text-xs font-bold ${item.enabled ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{item.enabled ? "Aberto" : "Fechado"}</span></div>)}</div>

          <div className="mt-5 grid gap-4 md:grid-cols-3"><label><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Delivery mínimo (min)</span><input type="number" min="5" className={input} value={draft.deliveryMinMinutes} onChange={(e)=>setDraft({...draft,deliveryMinMinutes:Number(e.target.value)})}/><small className="mt-1 block text-xs text-gray-400">Ex.: 30 minutos</small></label><label><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Delivery máximo (min)</span><input type="number" min="5" className={input} value={draft.deliveryMaxMinutes} onChange={(e)=>setDraft({...draft,deliveryMaxMinutes:Number(e.target.value)})}/><small className="mt-1 block text-xs text-gray-400">Ex.: 50 minutos</small></label><label><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Antecedência retirada</span><input type="number" min="5" className={input} value={draft.pickupLeadMinutes} onChange={(e)=>setDraft({...draft,pickupLeadMinutes:Number(e.target.value)})}/></label><label><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Intervalo dos horários</span><input type="number" min="5" step="5" className={input} value={draft.slotIntervalMinutes} onChange={(e)=>setDraft({...draft,slotIntervalMinutes:Number(e.target.value)})}/></label><label><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Agendar até (dias)</span><input type="number" min="1" max="60" className={input} value={draft.schedulingDaysAhead} onChange={(e)=>setDraft({...draft,schedulingDaysAhead:Number(e.target.value)})}/></label><label><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Pedido mínimo</span><input type="number" min="0" step="0.01" className={input} value={draft.minimumOrder} onChange={(e)=>setDraft({...draft,minimumOrder:Number(e.target.value)})}/></label><label className="md:col-span-3"><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Chave PIX</span><input className={input} value={draft.pixKey} onChange={(e)=>setDraft({...draft,pixKey:e.target.value})} placeholder="CPF, telefone, e-mail ou chave aleatória"/></label></div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">{[["acceptingOrders","Operação liberada"],["pickupEnabled","Retirada ativa"],["deliveryEnabled","Delivery ativo"]].map(([key,label])=><label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3"><span className="text-sm font-bold text-gray-800">{label}</span><input type="checkbox" checked={Boolean(draft[key as keyof StoreSettings])} onChange={(e)=>setDraft({...draft,[key]:e.target.checked})} className="h-5 w-5"/></label>)}</div>
          <label className="mt-4 block"><span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Instruções para retirada</span><textarea rows={3} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400" value={draft.pickupInstructions} onChange={(e)=>setDraft({...draft,pickupInstructions:e.target.value})}/></label>
        </section>

        {message && <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{message}</div>}
        <button disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"><Save className="h-4 w-4" />{busy ? "Salvando..." : "Salvar configurações gerais"}</button>
      </form>

      <DeliverySettings settings={draft} deliveryZones={deliveryZones} couriers={couriers} onDeliveryZonesChanged={onDeliveryZonesChanged} onCouriersChanged={onCouriersChanged} />
    </div>
  )
}

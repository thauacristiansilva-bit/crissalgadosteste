"use client"

import { useEffect, useState } from "react"

type Channel = "email" | "sms"
type Contact = { channel:Channel; configured:boolean; enrolled:boolean; destination:string }

export function DeliverySecurityPanel() {
  const [contacts,setContacts] = useState<Contact[]>([])
  const [channel,setChannel] = useState<Channel>("email")
  const [phone,setPhone] = useState("")
  const [verifier,setVerifier] = useState("")
  const [pending,setPending] = useState<{ id:string; destination:string } | null>(null)
  const [code,setCode] = useState("")
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState("")
  const field = "mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"

  useEffect(() => {
    let active = true
    fetch("/api/admin/2fa/delivery", { cache:"no-store" }).then(async (response) => {
      const data = await response.json()
      if (!active) return
      if (response.ok && Array.isArray(data.channels)) setContacts(data.channels)
      else setMessage(data.error || "O envio ainda não está disponível.")
    }).catch(() => { if (active) setMessage("Não foi possível carregar o envio de códigos.") })
    return () => { active = false }
  },[])

  async function action(type:"send" | "verify" | "remove", selected=channel) {
    setBusy(true); setMessage("")
    try {
      const response = await fetch("/api/admin/2fa/delivery", { method:"POST",headers:{ "Content-Type":"application/json" },body:JSON.stringify(type === "verify" ? { action:type,id:pending?.id,code } : { action:type,channel:selected,phone,verifier }) })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Não foi possível concluir. Tente novamente.")
      setVerifier("")
      if (type === "send") { setPending({ id:data.id,destination:data.destination }); setCode(""); setMessage("Código enviado. Digite abaixo para confirmar este contato. Válido por 5 minutos.") }
      else { setPending(null);setCode("");setContacts(data.channels || []);setMessage(type === "verify" ? "Contato confirmado. No próximo login, você poderá receber o código por este canal." : "Método removido do login.") }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao configurar.") }
    finally { setBusy(false) }
  }

  const selected = contacts.find((contact) => contact.channel === channel)
  return <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-black">Receber código por e-mail ou SMS</h2>
    <p className="mt-1 text-sm text-gray-500">Cadastre um contato confirmado para usar no login. O e-mail será o da sua conta. Passkey e autenticador oferecem maior proteção.</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">{contacts.map((contact) => <div key={contact.channel} className="rounded-xl border p-3 text-sm"><strong>{contact.channel === "email" ? "E-mail" : "SMS"}</strong><p className="mt-1 text-xs text-gray-500">{contact.enrolled ? `Confirmado: ${contact.destination}` : "Não cadastrado"}{!contact.configured ? " · envio indisponível" : ""}</p>{contact.enrolled && <button type="button" disabled={busy || !verifier.trim()} onClick={() => action("remove",contact.channel)} className="mt-2 text-xs font-bold text-red-700 disabled:opacity-40">Remover do login</button>}</div>)}</div>
    {!pending ? <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void action("send") }}>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Receber por<select value={channel} onChange={(event) => setChannel(event.target.value as Channel)} className={field}><option value="email">E-mail da minha conta</option><option value="sms">SMS no meu telefone</option></select></label>{channel === "sms" && <label className="text-xs font-bold">Telefone com DDD<input required type="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(99) 98104-8054" className={field}/></label>}</div>
      <label className="block text-xs font-bold">Confirme sua identidade com o código do autenticador ou de recuperação<input required maxLength={40} autoComplete="one-time-code" value={verifier} onChange={(event) => setVerifier(event.target.value)} className={field}/></label>
      <button disabled={busy || !selected?.configured} className="rounded-xl bg-gray-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? "Enviando…" : "Enviar código para confirmar contato"}</button>
      {selected && !selected.configured && <p className="text-xs text-gray-500">O responsável pelo SaborFlow precisa habilitar o envio deste canal.</p>}
    </form> : <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void action("verify") }}>
      <p className="text-sm">Código enviado para <strong>{pending.destination}</strong>.</p>
      <label className="block text-xs font-bold">Código recebido<input required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g,""))} className={field}/></label>
      <div className="flex flex-wrap gap-2"><button disabled={busy} className="rounded-xl bg-gray-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Confirmar contato</button><button type="button" disabled={busy} onClick={() => { setPending(null);setCode("") }} className="rounded-xl border px-4 py-3 text-sm font-bold">Voltar / solicitar novo código</button></div>
    </form>}
    {message && <p role="status" className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{message}</p>}
  </section>
}

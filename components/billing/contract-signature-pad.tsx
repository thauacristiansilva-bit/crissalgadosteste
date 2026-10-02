"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Eraser, FileSignature, LoaderCircle } from "lucide-react"
import type { BillingCycle, PaymentMethod } from "@/lib/billing-types"

type Props = {
  planCode: string
  billingCycle: BillingCycle
  paymentMethod: PaymentMethod
  contractAccepted: boolean
  commitmentAccepted: boolean
  disabled?: boolean
  onSigned: (result: { contractId: string; pdfUrl: string; signedAt: string }) => void
  onReset: () => void
}

export function ContractSignaturePad(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const [hasInk, setHasInk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [signed, setSigned] = useState<{ contractId: string; pdfUrl: string; signedAt: string } | null>(null)

  function prepareCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    canvas.width = Math.max(600, Math.floor(rect.width * ratio))
    canvas.height = Math.floor(180 * ratio)
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = "#1c1917"
    ctx.lineWidth = Math.max(3, 3 * ratio)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    setHasInk(false)
  }

  useEffect(() => { prepareCanvas() }, [])
  useEffect(() => {
    setSigned(null)
    setError("")
    props.onReset()
    prepareCanvas()
  }, [props.planCode, props.billingCycle, props.paymentMethod, props.contractAccepted, props.commitmentAccepted])

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function down(event: React.PointerEvent<HTMLCanvasElement>) {
    if (props.disabled || signed) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    canvas.setPointerCapture(event.pointerId)
    drawingRef.current = true
    const p = point(event)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || props.disabled || signed) return
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const p = point(event)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    setHasInk(true)
  }

  function up(event: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false
    try { canvasRef.current?.releasePointerCapture(event.pointerId) } catch {}
  }

  function clear() {
    setSigned(null)
    setError("")
    props.onReset()
    prepareCanvas()
  }

  async function sign() {
    if (busy || !hasInk || !canvasRef.current) return
    if (!props.contractAccepted) { setError("Aceite o contrato, os Termos de Uso e o Aviso de Privacidade antes de assinar."); return }
    if (props.billingCycle !== "monthly" && !props.commitmentAccepted) { setError("Confirme a regra de permanência e cancelamento antes de assinar."); return }
    setBusy(true)
    setError("")
    try {
      const signatureDataUrl = canvasRef.current.toDataURL("image/jpeg", 0.84)
      const response = await fetch("/api/billing/contracts/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode: props.planCode,
          billingCycle: props.billingCycle,
          paymentMethod: props.paymentMethod,
          signatureDataUrl,
          termsAccepted: props.contractAccepted,
          privacyAccepted: props.contractAccepted,
          contractAccepted: props.contractAccepted,
          commitmentAccepted: props.billingCycle === "monthly" ? true : props.commitmentAccepted,
        }),
      })
      const payload = await response.json().catch(() => ({})) as { error?: string; contractId?: string; pdfUrl?: string; signedAt?: string }
      if (!response.ok || !payload.contractId || !payload.pdfUrl || !payload.signedAt) throw new Error(payload.error || "Não foi possível assinar o contrato.")
      const result = { contractId: payload.contractId, pdfUrl: payload.pdfUrl, signedAt: payload.signedAt }
      setSigned(result)
      props.onSigned(result)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível assinar o contrato.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-3xl border-2 border-orange-200 bg-orange-50/40 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <FileSignature className="mt-0.5 h-6 w-6 shrink-0 text-orange-700" />
        <div>
          <h3 className="text-lg font-black text-stone-950">Assine antes de ir para o pagamento</h3>
          <p className="mt-1 text-sm leading-6 text-stone-600">Use o dedo no celular ou o mouse no computador. A assinatura será inserida no PDF junto com a data, identificação da conta e trilha de auditoria.</p>
        </div>
      </div>

      {signed ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 font-black text-emerald-800"><CheckCircle2 className="h-5 w-5" />Contrato assinado</div>
          <p className="mt-2 text-sm text-emerald-800">O pagamento foi liberado. Depois da aprovação financeira, o PDF assinado será enviado para o e-mail da conta.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <a href={signed.pdfUrl} target="_blank" className="rounded-xl bg-white px-4 py-2.5 text-center text-sm font-black text-emerald-800 ring-1 ring-emerald-200">Abrir PDF assinado</a>
            <button type="button" onClick={clear} className="rounded-xl px-4 py-2.5 text-sm font-black text-stone-600">Refazer assinatura</button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-inner">
            <canvas
              ref={canvasRef}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              className={`block h-[180px] w-full touch-none ${props.disabled ? "cursor-not-allowed opacity-50" : "cursor-crosshair"}`}
              aria-label="Área para assinatura eletrônica"
            />
          </div>
          <p className="mt-2 text-xs text-stone-500">Assine dentro do quadro. A assinatura precisa conter um traço visível.</p>
          {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={clear} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-black text-stone-700"><Eraser className="h-4 w-4" />Limpar</button>
            <button type="button" onClick={() => void sign()} disabled={busy || !hasInk || props.disabled || !props.contractAccepted || (props.billingCycle !== "monthly" && !props.commitmentAccepted)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
              {busy ? "Gerando contrato..." : "Assinar contrato e liberar pagamento"}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

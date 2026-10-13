"use client"

import { useEffect, useRef, useState } from "react"
import { imagePlacement, imageTarget, type PublicationChannel } from "@/lib/publication-image-layout"

type Props = { file: File; channel: PublicationChannel; onApply: (file: File) => Promise<boolean>; onCancel: () => void }
export function PublicationImageEditor({ file, channel, onApply, onCancel }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [mode, setMode] = useState<"contain" | "cover">("contain")
  const [zoom, setZoom] = useState(1)
  const [x, setX] = useState(0.5)
  const [y, setY] = useState(0.5)
  const [background, setBackground] = useState("#ffffff")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const target = imageTarget(channel)

  useEffect(() => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 15 * 1024 * 1024) {
      setError("Anexe JPG, PNG ou WEBP de até 15 MB."); return
    }
    let active = true
    const url = URL.createObjectURL(file)
    const loaded = new Image()
    loaded.onload = () => {
      if (!active) return
      if (!loaded.naturalWidth || !loaded.naturalHeight || loaded.naturalWidth * loaded.naturalHeight > 40_000_000) setError("Use uma imagem de até 40 megapixels.")
      else setImage(loaded)
    }
    loaded.onerror = () => { if (active) setError("Não foi possível abrir a imagem. Tente outro arquivo.") }
    loaded.src = url
    return () => { active = false; URL.revokeObjectURL(url) }
  }, [file])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    dialog.current?.focus()
    return () => { document.body.style.overflow = overflow; previous?.focus() }
  }, [])

  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext("2d")
    if (!element || !ctx || !image) return
    element.width = target.width; element.height = target.height
    ctx.fillStyle = background; ctx.fillRect(0, 0, element.width, element.height)
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"
    const p = imagePlacement(image.naturalWidth, image.naturalHeight, target.width, target.height, mode, zoom, x, y)
    ctx.drawImage(image, p.left, p.top, p.width, p.height)
  }, [image, mode, zoom, x, y, background, target.width, target.height])

  async function apply() {
    if (!canvas.current || !image || busy) return
    setBusy(true); setError("")
    try {
      const element = canvas.current
      const blob = await new Promise<Blob>((resolve, reject) => element.toBlob(value => value ? resolve(value) : reject(new Error("Não foi possível preparar a imagem.")), "image/jpeg", 0.94))
      if (blob.size > 10 * 1024 * 1024) throw new Error("Imagem muito grande. Tente outro arquivo.")
      const saved = await onApply(new File([blob], `publicacao-${channel}-${Date.now()}.jpg`, { type: "image/jpeg" }))
      if (saved) onCancel()
      else setError("Não foi possível enviar. Confira a conexão e tente novamente.")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao preparar a imagem.") }
    finally { setBusy(false) }
  }

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3">
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="image-editor-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 text-gray-950 shadow-xl" onKeyDown={event => {
      if (event.key === "Escape" && !busy) onCancel()
      if (event.key === "Tab") {
        const nodes = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')
        if (!nodes?.length) { event.preventDefault(); return }
        const first = nodes[0], last = nodes[nodes.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus() }
      }
    }}>
      <div className="flex items-center justify-between gap-3"><h2 id="image-editor-title" className="text-xl font-bold">Ajustar imagem</h2><button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border px-3 py-2">Fechar</button></div>
      <p className="mt-2 text-sm text-gray-600">{channel === "instagram_feed" ? "Feed do Instagram" : channel === "instagram_story" ? "Story do Instagram" : "Status do WhatsApp"} · {target.width} × {target.height} px</p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <div className="flex items-start justify-center rounded-xl bg-gray-100 p-3"><canvas ref={canvas} aria-label="Prévia da imagem que será salva" className="h-auto max-h-[52vh] w-auto max-w-full border bg-white shadow" style={{ aspectRatio: `${target.width}/${target.height}` }} /></div>
        <fieldset disabled={busy} className="space-y-4">
          <div className="flex flex-wrap gap-2">{(["contain", "cover"] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => { setMode(value); setZoom(1); setX(0.5); setY(0.5) }} className={`rounded-xl border px-3 py-2 text-sm font-bold ${mode === value ? "bg-violet-700 text-white" : "bg-white"}`}>{value === "contain" ? "Imagem inteira" : "Preencher com corte"}</button>)}</div>
          <p className="text-sm text-gray-600">{mode === "contain" ? "Mantém toda a arte, incluindo textos e preços. O espaço restante recebe a cor do fundo." : "Preenche o quadro. Ajuste a posição para não cortar o que é importante."}</p>
          {mode === "cover" && <label className="block text-sm font-bold">Zoom<input className="mt-2 w-full" type="range" min="1" max="3" step="0.01" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label>}
          <label className="block text-sm font-bold">Posição horizontal<input className="mt-2 w-full" type="range" min="0" max="1" step="0.01" value={x} onChange={e => setX(Number(e.target.value))} /></label>
          <label className="block text-sm font-bold">Posição vertical<input className="mt-2 w-full" type="range" min="0" max="1" step="0.01" value={y} onChange={e => setY(Number(e.target.value))} /></label>
          <label className="flex items-center gap-3 text-sm font-bold">Cor do fundo<input type="color" value={background} onChange={e => setBackground(e.target.value)} /></label>
          <button type="button" onClick={() => { setMode("contain"); setZoom(1); setX(0.5); setY(0.5); setBackground("#ffffff") }} className="text-sm font-bold underline">Restaurar ajuste</button>
          {image && (image.naturalWidth < target.width || image.naturalHeight < target.height) && <p className="text-xs text-amber-800">A imagem original é pequena. O ajuste de tamanho não recupera detalhes perdidos.</p>}
        </fieldset>
      </div>
      {error && <p role="alert" className="mt-4 text-sm font-bold text-red-700">{error}</p>}
      <button type="button" disabled={!image || busy} onClick={() => void apply()} className="mt-5 w-full rounded-xl bg-violet-700 px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? "Preparando e enviando..." : "Usar esta imagem"}</button>
    </div>
  </div>
}

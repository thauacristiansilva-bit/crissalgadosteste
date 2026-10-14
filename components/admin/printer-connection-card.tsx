"use client"

import { useState } from "react"

/** A impressora fisica e escolhida pelo Windows/navegador; nunca tenta usar hardware do servidor. */
export function PrinterConnectionCard() {
  const [notice, setNotice] = useState("")
  function printTest() {
    const popup = window.open("", "_blank", "width=440,height=650")
    if (!popup) {
      setNotice("O navegador bloqueou o teste. Libere pop-ups para este site e tente novamente.")
      return
    }
    const now = new Date().toLocaleString("pt-BR")
    popup.document.open()
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Teste SaborFlow</title><style>@page{size:80mm auto;margin:3mm}body{font:14px Consolas,monospace;margin:5mm;color:black}h1{text-align:center;font-size:18px}hr{border:0;border-top:1px dashed #111}.p{font-weight:700}</style></head><body><h1>SABORFLOW</h1><hr><p class="p">TESTE DE IMPRESSORA</p><p>Conexao do navegador: OK</p><p id="time"></p><hr><p>Teste de ticket de cozinha</p><p>Selecione a impressora instalada no Windows.</p></body></html>`)
    const clock = popup.document.getElementById("time")
    if (clock) clock.textContent = now
    popup.document.close()
    popup.focus()
    popup.print()
    setNotice("Janela de impressão aberta. Este teste não verifica a impressão automática do agente local.")
  }
  return <section data-sf-printer-recovery="v1" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <h3 className="text-lg font-black text-slate-900">Impressora e tickets</h3>
    <p className="mt-1 text-sm text-slate-600">Use a impressora que já está instalada no computador da loja. A configuração física de USB, rede e Bluetooth pertence ao Windows ou ao agente de impressão.</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" onClick={printTest} className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white">Testar impressão</button>
    </div>
    {notice && <p role="status" className="mt-3 text-sm text-slate-700">{notice}</p>}
    <p className="mt-3 text-xs text-slate-600">Impressão automática: mantenha o agente SaborFlow já instalado no computador aberto e conectado. Este ajuste restaura o acesso à área de impressão, mas não reinstala nem configura o agente existente.</p>
    <p className="mt-2 text-xs text-slate-600">Em Windows, confira Configurações → Bluetooth e dispositivos → Impressoras e scanners. Para pedidos reais, use os botões Ticket cozinha/Ticket cliente.</p>
  </section>
}

"use client"

import type { CSSProperties } from "react"
import type { StoreSettings } from "@/lib/types"

const fontOptions = [
  { value: "modern", label: "Moderna", family: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { value: "rounded", label: "Arredondada", family: "'Trebuchet MS', 'Arial Rounded MT Bold', Arial, sans-serif" },
  { value: "elegant", label: "Elegante", family: "Georgia, 'Times New Roman', serif" },
  { value: "impact", label: "Impacto", family: "Impact, 'Arial Black', sans-serif" },
] as const

export function StoreBrandingEditor({
  settings,
  onChange,
}: {
  settings: StoreSettings
  onChange: (settings: StoreSettings) => void
}) {
  const mode = settings.storeTitleMode || "text"
  const font = settings.storeTitleFont || "modern"
  const color = settings.storeTitleColor || settings.primaryColor || "#111827"
  const selectedFont = fontOptions.find((item) => item.value === font) || fontOptions[0]
  const previewStyle = { color, fontFamily: selectedFont.family } as CSSProperties
  const canUseLogo = Boolean(settings.logoImage?.trim())

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">Identidade visual</p>
        <h2 className="mt-1 text-lg font-black">Nome da empresa no cardápio e pedidos</h2>
        <p className="mt-1 text-sm text-gray-500">
          Escolha se o cliente verá o nome em texto personalizado ou a logo da empresa.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <label>
          <span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Exibição</span>
          <select
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-orange-300"
            value={mode}
            onChange={(event) =>
              onChange({
                ...settings,
                storeTitleMode: event.target.value as StoreSettings["storeTitleMode"],
              })
            }
          >
            <option value="text">Nome em texto</option>
            <option value="logo">Logo no lugar do nome</option>
          </select>
        </label>

        <label>
          <span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Fonte do nome</span>
          <select
            disabled={mode === "logo"}
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-orange-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
            value={font}
            onChange={(event) =>
              onChange({
                ...settings,
                storeTitleFont: event.target.value as StoreSettings["storeTitleFont"],
              })
            }
          >
            {fontOptions.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Cor do nome</span>
          <div className="flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-2">
            <input
              type="color"
              disabled={mode === "logo"}
              value={/^#[0-9a-f]{6}$/i.test(color) ? color : "#111827"}
              onChange={(event) => onChange({ ...settings, storeTitleColor: event.target.value })}
              className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed"
              aria-label="Cor do nome da empresa"
            />
            <input
              disabled={mode === "logo"}
              value={color}
              onChange={(event) => onChange({ ...settings, storeTitleColor: event.target.value })}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold uppercase outline-none disabled:text-gray-400"
              maxLength={16}
              placeholder="#111827"
            />
          </div>
        </label>
      </div>

      <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-500">Prévia</p>
            <p className="text-xs text-gray-400">Visual aproximado do cabeçalho para o cliente.</p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase text-gray-500 shadow-sm">
            {mode === "logo" ? "Logo" : selectedFont.label}
          </span>
        </div>

        <div className="flex min-h-20 items-center rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
          {mode === "logo" && canUseLogo ? (
            <img src={settings.logoImage} alt={settings.storeName} className="max-h-16 max-w-[280px] object-contain" />
          ) : (
            <div>
              <div className="break-words text-3xl font-black leading-tight" style={previewStyle}>
                {settings.storeName || "Nome da empresa"}
              </div>
              {mode === "logo" && !canUseLogo ? (
                <p className="mt-2 text-xs font-semibold text-amber-700">
                  Nenhuma logo está cadastrada. Enquanto isso, o nome continuará aparecendo.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        A logo utilizada é a mesma já cadastrada nas configurações da empresa. Depois de escolher a aparência, use o botão de salvar das configurações.
      </p>
    </section>
  )
}

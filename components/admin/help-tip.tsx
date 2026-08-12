"use client"

import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { adminHelp, type AdminHelpKey } from "@/lib/admin-help"

type Position = {
  left: number
  top: number
  width: number
}

export function HelpTip({ helpKey, className = "" }: { helpKey: AdminHelpKey; className?: string }) {
  const help = adminHelp[helpKey]
  const buttonRef = useRef<HTMLButtonElement>(null)
  const rootRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<Position>({ left: 12, top: 12, width: 288 })
  const tooltipId = useId()

  const updatePosition = useCallback(() => {
    const button = buttonRef.current
    if (!button || typeof window === "undefined") return
    const rect = button.getBoundingClientRect()
    const width = Math.min(288, Math.max(220, window.innerWidth - 24))
    const centered = rect.left + rect.width / 2 - width / 2
    const left = Math.max(12, Math.min(centered, window.innerWidth - width - 12))
    const top = Math.min(rect.bottom + 8, window.innerHeight - 24)
    setPosition({ left, top, width })
  }, [])

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const reposition = () => updatePosition()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && rootRef.current?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)
    document.addEventListener("keydown", closeOnEscape)
    document.addEventListener("pointerdown", closeOutside)
    return () => {
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
      document.removeEventListener("keydown", closeOnEscape)
      document.removeEventListener("pointerdown", closeOutside)
    }
  }, [open, updatePosition])

  return (
    <span ref={rootRef} className={`relative inline-flex shrink-0 align-middle ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Ajuda: ${help.title}`}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] font-black leading-none text-gray-500 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        ?
      </button>
      {mounted && open && createPortal(
        <div
          id={tooltipId}
          role="tooltip"
          style={{ left: position.left, top: position.top, width: position.width }}
          className="fixed z-[200] rounded-xl border border-gray-200 bg-gray-950 px-3 py-2.5 text-left text-white shadow-2xl"
        >
          <p className="text-xs font-black">{help.title}</p>
          <p className="mt-1 text-[11px] leading-4 text-gray-200">{help.text}</p>
        </div>,
        document.body,
      )}
    </span>
  )
}

export function HelpLabel({ helpKey, children, className = "" }: { helpKey: AdminHelpKey; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1.5 ${className}`}>{children}<HelpTip helpKey={helpKey} /></span>
}

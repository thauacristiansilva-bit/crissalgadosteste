import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "SaborFlow — Gestão para alimentação",
  description: "Pedidos, PDV, cozinha, delivery, estoque e gestão comercial no SaborFlow.",
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
}

export const viewport: Viewport = { colorScheme: "light", themeColor: "#f97316" }

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="pt-BR"><body className="min-h-screen font-sans antialiased">{children}</body></html>
}

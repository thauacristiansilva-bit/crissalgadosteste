import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL("https://appsaborflow.com.br"),

  title: {
    default: "SaborFlow — Gestão para alimentação",
    template: "%s | SaborFlow",
  },

  description:
    "Pedidos, PDV, cozinha, delivery, estoque, clientes e gestão comercial em um único fluxo com o SaborFlow.",

  applicationName: "SaborFlow",

  icons: {
    icon: "/saborflow-brand.png",
    shortcut: "/saborflow-brand.png",
    apple: "/saborflow-brand.png",
  },

  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://appsaborflow.com.br",
    siteName: "SaborFlow",
    title: "SaborFlow — Gestão para alimentação",
    description:
      "Pedidos, PDV, cozinha, delivery, estoque, clientes e gestão comercial em um único fluxo.",
    images: [
      {
        url: "/og-image.png",
        alt: "SaborFlow — Gestão para alimentação",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "SaborFlow — Gestão para alimentação",
    description:
      "Pedidos, PDV, cozinha, delivery, estoque, clientes e gestão comercial em um único fluxo.",
    images: ["/og-image.png"],
  },
}

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f97316",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  )
}

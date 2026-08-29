import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import "./globals.css"

const appBaseUrl =
  process.env.APP_BASE_URL?.trim() ||
  "https://appsaborflow.com.br"

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl),
  title: "SaborFlow — Gestão para alimentação",
  description:
    "Pedidos, PDV, cozinha, delivery, estoque e gestão comercial no SaborFlow.",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: appBaseUrl,
    siteName: "SaborFlow",
    title: "SaborFlow — Gestão para alimentação",
    description:
      "Pedidos, PDV, cozinha, delivery, estoque e gestão comercial no SaborFlow.",
    images: [
      {
        url: `${appBaseUrl}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: "SaborFlow — Gestão para alimentação",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SaborFlow — Gestão para alimentação",
    description:
      "Pedidos, PDV, cozinha, delivery, estoque e gestão comercial no SaborFlow.",
    images: [`${appBaseUrl}/og-image.jpg`],
  },
}

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f97316",
}

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
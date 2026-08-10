import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type ViaCepResponse = {
  cep?: string
  logradouro?: string
  complemento?: string
  bairro?: string
  localidade?: string
  uf?: string
  ibge?: string
  erro?: boolean | "true"
}

function normalizeCep(value: string) {
  return value.replace(/\D/g, "").slice(0, 8)
}

export async function GET(request: NextRequest) {
  const cep = normalizeCep(request.nextUrl.searchParams.get("cep") || "")

  if (!/^\d{8}$/.test(cep)) {
    return NextResponse.json({ error: "Informe um CEP válido com 8 números." }, { status: 400 })
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })

    if (!response.ok) {
      throw new Error(`ViaCEP respondeu com status ${response.status}.`)
    }

    const data = (await response.json()) as ViaCepResponse
    if (data.erro === true || data.erro === "true") {
      return NextResponse.json({ error: "CEP não encontrado." }, { status: 404 })
    }

    return NextResponse.json({
      cep: data.cep || cep,
      address: data.logradouro || "",
      district: data.bairro || "",
      city: data.localidade || "",
      state: data.uf || "",
      complement: data.complemento || "",
      ibge: data.ibge || "",
      source: "ViaCEP",
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível consultar o CEP." },
      { status: 502 },
    )
  }
}

/**
 * SaborFlow Etapa 10 — Worker de borda para domínios próprios de clientes.
 *
 * Configure uma rota *\/* para este Worker e uma rota mais específica
 * *.appsaborflow.com.br/* sem Worker. Assim apenas hostnames externos
 * cadastrados no Cloudflare for SaaS passam por este proxy.
 */
export default {
  async fetch(request, env) {
    const originalUrl = new URL(request.url)
    const originalHost = originalUrl.hostname.toLowerCase()
    const originHost = (env.SABORFLOW_ORIGIN_HOST || "origin.appsaborflow.com.br").toLowerCase()
    const edgeToken = env.SABORFLOW_EDGE_TOKEN || ""

    if (!edgeToken) {
      return new Response("SaborFlow edge not configured", { status: 503 })
    }

    const upstreamUrl = new URL(request.url)
    upstreamUrl.protocol = "https:"
    upstreamUrl.hostname = originHost
    upstreamUrl.port = ""

    const headers = new Headers(request.headers)
    headers.set("x-saborflow-edge-host", originalHost)
    headers.set("x-saborflow-edge-token", edgeToken)
    headers.set("x-forwarded-host", originalHost)

    const init = {
      method: request.method,
      headers,
      redirect: "manual",
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body
    }

    const upstream = await fetch(upstreamUrl.toString(), init)
    const responseHeaders = new Headers(upstream.headers)

    // Mantém redirects no domínio visto pelo cliente, nunca no hostname de origem.
    const location = responseHeaders.get("location")
    if (location) {
      try {
        const redirect = new URL(location, upstreamUrl)
        if (redirect.hostname.toLowerCase() === originHost) {
          redirect.protocol = originalUrl.protocol
          redirect.hostname = originalHost
          responseHeaders.set("location", redirect.toString())
        }
      } catch {
        // Redirect relativo não precisa de alteração.
      }
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  },
}

import path from "node:path"

const googleIdentityOrigin = "https://accounts.google.com"

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",

  [
    "script-src",
    "'self'",
    "'unsafe-inline'",
    process.env.NODE_ENV === "development"
      ? "'unsafe-eval'"
      : "",
    googleIdentityOrigin,

    // Google Maps / Google APIs
    "https://*.googleapis.com",
    "https://*.gstatic.com",
    "https://*.google.com",

    // Upload direto para Cloudflare R2
    "https://*.r2.cloudflarestorage.com",
  ]
    .filter(Boolean)
    .join(" "),

  "script-src-attr 'none'",

  [
    "style-src",
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
  ].join(" "),

  [
    "img-src",
    "'self'",
    "data:",
    "blob:",
    "https:",
  ].join(" "),

  [
    "font-src",
    "'self'",
    "data:",
    "https://fonts.gstatic.com",
  ].join(" "),

  [
    "connect-src",
    "'self'",

    // Login Google
    googleIdentityOrigin,

    // Google Maps / Places / Geocoding
    "https://*.googleapis.com",
    "https://*.gstatic.com",
    "https://*.google.com",
    "https://*.googleusercontent.com",

    // Upload direto de mídia para R2
    "https://*.r2.cloudflarestorage.com",

    // Recursos usados pelo navegador
    "data:",
    "blob:",
  ].join(" "),

  [
    "frame-src",
    "'self'",
    googleIdentityOrigin,
    "https://*.google.com",
  ].join(" "),

  [
    "worker-src",
    "'self'",
    "blob:",
  ].join(" "),

  [
    "media-src",
    "'self'",
    "blob:",
    "https:",
  ].join(" "),

  "manifest-src 'self'",

  process.env.NODE_ENV === "production"
    ? "upgrade-insecure-requests"
    : "",
]
  .filter(Boolean)
  .join("; ")

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(self), geolocation=(self), payment=(self), browsing-topics=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
  {
    key: "Origin-Agent-Cluster",
    value: "?1",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
  {
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none",
  },
]

const privateNoStoreHeaders = [
  {
    key: "Cache-Control",
    value: "private, no-store, max-age=0",
  },
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive",
  },
]

const apiNoStoreHeaders = [
  {
    key: "Cache-Control",
    value: "no-store, max-age=0",
  },
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive",
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,

  images: {
    unoptimized: true,
  },

  turbopack: {
    root: path.resolve(process.cwd()),
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },

      // =========================
      // PAINÉIS PRIVADOS
      // =========================

      {
        source: "/admin/:path*",
        headers: privateNoStoreHeaders,
      },
      {
        source: "/superadmin/:path*",
        headers: privateNoStoreHeaders,
      },
      {
        source: "/gerente/:path*",
        headers: privateNoStoreHeaders,
      },
      {
        source: "/pdv/:path*",
        headers: privateNoStoreHeaders,
      },
      {
        source: "/cozinha/:path*",
        headers: privateNoStoreHeaders,
      },
      {
        source: "/entregador/:path*",
        headers: privateNoStoreHeaders,
      },
      {
        source: "/onboarding/:path*",
        headers: privateNoStoreHeaders,
      },
      {
        source: "/minha-loja/:path*",
        headers: privateNoStoreHeaders,
      },

      // =========================
      // APIs SENSÍVEIS
      // =========================

      {
        source: "/api/admin/:path*",
        headers: apiNoStoreHeaders,
      },
      {
        source: "/api/auth/:path*",
        headers: apiNoStoreHeaders,
      },
      {
        source: "/api/superadmin/:path*",
        headers: apiNoStoreHeaders,
      },
      {
        source: "/api/client/:path*",
        headers: apiNoStoreHeaders,
      },
      {
        source: "/api/billing/:path*",
        headers: apiNoStoreHeaders,
      },
    ]
  },
}

export default nextConfig
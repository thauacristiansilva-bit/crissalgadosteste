$ErrorActionPreference = "Stop"

if (-not (Test-Path "next.config.mjs")) {
  throw "Execute este script na pasta raiz do SaborFlow."
}

Write-Host "=== ETAPA 13.11 - CSP E HEADERS DE SEGURANCA ==="
Write-Host ""

$data = [Convert]::FromBase64String("aW1wb3J0IHBhdGggZnJvbSAibm9kZTpwYXRoIgoKY29uc3QgZ29vZ2xlSWRlbnRpdHlPcmlnaW4gPSAiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tIgoKY29uc3QgY29udGVudFNlY3VyaXR5UG9saWN5ID0gWwogICJkZWZhdWx0LXNyYyAnc2VsZiciLAogICJiYXNlLXVyaSAnc2VsZiciLAogICJvYmplY3Qtc3JjICdub25lJyIsCiAgImZyYW1lLWFuY2VzdG9ycyAnbm9uZSciLAogICJmb3JtLWFjdGlvbiAnc2VsZiciLAogIFsKICAgICJzY3JpcHQtc3JjIiwKICAgICInc2VsZiciLAogICAgIid1bnNhZmUtaW5saW5lJyIsCiAgICBwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gImRldmVsb3BtZW50IiA/ICIndW5zYWZlLWV2YWwnIiA6ICIiLAogICAgZ29vZ2xlSWRlbnRpdHlPcmlnaW4sCiAgXQogICAgLmZpbHRlcihCb29sZWFuKQogICAgLmpvaW4oIiAiKSwKICAic2NyaXB0LXNyYy1hdHRyICdub25lJyIsCiAgInN0eWxlLXNyYyAnc2VsZicgJ3Vuc2FmZS1pbmxpbmUnIiwKICAiaW1nLXNyYyAnc2VsZicgZGF0YTogYmxvYjogaHR0cHM6IiwKICAiZm9udC1zcmMgJ3NlbGYnIGRhdGE6IiwKICBbCiAgICAiY29ubmVjdC1zcmMiLAogICAgIidzZWxmJyIsCiAgICBnb29nbGVJZGVudGl0eU9yaWdpbiwKICAgICJodHRwczovLyouZ29vZ2xlLmNvbSIsCiAgXS5qb2luKCIgIiksCiAgYGZyYW1lLXNyYyAnc2VsZicgJHtnb29nbGVJZGVudGl0eU9yaWdpbn1gLAogICJ3b3JrZXItc3JjICdzZWxmJyBibG9iOiIsCiAgIm1lZGlhLXNyYyAnc2VsZicgYmxvYjogaHR0cHM6IiwKICAibWFuaWZlc3Qtc3JjICdzZWxmJyIsCiAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICJwcm9kdWN0aW9uIgogICAgPyAidXBncmFkZS1pbnNlY3VyZS1yZXF1ZXN0cyIKICAgIDogIiIsCl0KICAuZmlsdGVyKEJvb2xlYW4pCiAgLmpvaW4oIjsgIikKCmNvbnN0IHNlY3VyaXR5SGVhZGVycyA9IFsKICB7CiAgICBrZXk6ICJDb250ZW50LVNlY3VyaXR5LVBvbGljeSIsCiAgICB2YWx1ZTogY29udGVudFNlY3VyaXR5UG9saWN5LAogIH0sCiAgewogICAga2V5OiAiU3RyaWN0LVRyYW5zcG9ydC1TZWN1cml0eSIsCiAgICB2YWx1ZTogIm1heC1hZ2U9NjMwNzIwMDA7IGluY2x1ZGVTdWJEb21haW5zOyBwcmVsb2FkIiwKICB9LAogIHsKICAgIGtleTogIlgtQ29udGVudC1UeXBlLU9wdGlvbnMiLAogICAgdmFsdWU6ICJub3NuaWZmIiwKICB9LAogIHsKICAgIGtleTogIlgtRnJhbWUtT3B0aW9ucyIsCiAgICB2YWx1ZTogIkRFTlkiLAogIH0sCiAgewogICAga2V5OiAiUmVmZXJyZXItUG9saWN5IiwKICAgIHZhbHVlOiAic3RyaWN0LW9yaWdpbi13aGVuLWNyb3NzLW9yaWdpbiIsCiAgfSwKICB7CiAgICBrZXk6ICJQZXJtaXNzaW9ucy1Qb2xpY3kiLAogICAgdmFsdWU6CiAgICAgICJjYW1lcmE9KCksIG1pY3JvcGhvbmU9KHNlbGYpLCBnZW9sb2NhdGlvbj0oc2VsZiksIHBheW1lbnQ9KHNlbGYpLCBicm93c2luZy10b3BpY3M9KCkiLAogIH0sCiAgewogICAga2V5OiAiQ3Jvc3MtT3JpZ2luLU9wZW5lci1Qb2xpY3kiLAogICAgdmFsdWU6ICJzYW1lLW9yaWdpbi1hbGxvdy1wb3B1cHMiLAogIH0sCiAgewogICAga2V5OiAiQ3Jvc3MtT3JpZ2luLVJlc291cmNlLVBvbGljeSIsCiAgICB2YWx1ZTogInNhbWUtb3JpZ2luIiwKICB9LAogIHsKICAgIGtleTogIk9yaWdpbi1BZ2VudC1DbHVzdGVyIiwKICAgIHZhbHVlOiAiPzEiLAogIH0sCiAgewogICAga2V5OiAiWC1ETlMtUHJlZmV0Y2gtQ29udHJvbCIsCiAgICB2YWx1ZTogIm9mZiIsCiAgfSwKICB7CiAgICBrZXk6ICJYLVBlcm1pdHRlZC1Dcm9zcy1Eb21haW4tUG9saWNpZXMiLAogICAgdmFsdWU6ICJub25lIiwKICB9LApdCgpjb25zdCBwcml2YXRlTm9TdG9yZUhlYWRlcnMgPSBbCiAgewogICAga2V5OiAiQ2FjaGUtQ29udHJvbCIsCiAgICB2YWx1ZTogInByaXZhdGUsIG5vLXN0b3JlLCBtYXgtYWdlPTAiLAogIH0sCiAgewogICAga2V5OiAiWC1Sb2JvdHMtVGFnIiwKICAgIHZhbHVlOiAibm9pbmRleCwgbm9mb2xsb3csIG5vYXJjaGl2ZSIsCiAgfSwKXQoKY29uc3QgYXBpTm9TdG9yZUhlYWRlcnMgPSBbCiAgewogICAga2V5OiAiQ2FjaGUtQ29udHJvbCIsCiAgICB2YWx1ZTogIm5vLXN0b3JlLCBtYXgtYWdlPTAiLAogIH0sCiAgewogICAga2V5OiAiWC1Sb2JvdHMtVGFnIiwKICAgIHZhbHVlOiAibm9pbmRleCwgbm9mb2xsb3csIG5vYXJjaGl2ZSIsCiAgfSwKXQoKLyoqIEB0eXBlIHtpbXBvcnQoJ25leHQnKS5OZXh0Q29uZmlnfSAqLwpjb25zdCBuZXh0Q29uZmlnID0gewogIHBvd2VyZWRCeUhlYWRlcjogZmFsc2UsCiAgaW1hZ2VzOiB7IHVub3B0aW1pemVkOiB0cnVlIH0sCiAgdHVyYm9wYWNrOiB7IHJvb3Q6IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpKSB9LAogIGFzeW5jIGhlYWRlcnMoKSB7CiAgICByZXR1cm4gWwogICAgICB7CiAgICAgICAgc291cmNlOiAiLzpwYXRoKiIsCiAgICAgICAgaGVhZGVyczogc2VjdXJpdHlIZWFkZXJzLAogICAgICB9LAogICAgICB7CiAgICAgICAgc291cmNlOiAiL2FkbWluLzpwYXRoKiIsCiAgICAgICAgaGVhZGVyczogcHJpdmF0ZU5vU3RvcmVIZWFkZXJzLAogICAgICB9LAogICAgICB7CiAgICAgICAgc291cmNlOiAiL3N1cGVyYWRtaW4vOnBhdGgqIiwKICAgICAgICBoZWFkZXJzOiBwcml2YXRlTm9TdG9yZUhlYWRlcnMsCiAgICAgIH0sCiAgICAgIHsKICAgICAgICBzb3VyY2U6ICIvZ2VyZW50ZS86cGF0aCoiLAogICAgICAgIGhlYWRlcnM6IHByaXZhdGVOb1N0b3JlSGVhZGVycywKICAgICAgfSwKICAgICAgewogICAgICAgIHNvdXJjZTogIi9wZHYvOnBhdGgqIiwKICAgICAgICBoZWFkZXJzOiBwcml2YXRlTm9TdG9yZUhlYWRlcnMsCiAgICAgIH0sCiAgICAgIHsKICAgICAgICBzb3VyY2U6ICIvY296aW5oYS86cGF0aCoiLAogICAgICAgIGhlYWRlcnM6IHByaXZhdGVOb1N0b3JlSGVhZGVycywKICAgICAgfSwKICAgICAgewogICAgICAgIHNvdXJjZTogIi9lbnRyZWdhZG9yLzpwYXRoKiIsCiAgICAgICAgaGVhZGVyczogcHJpdmF0ZU5vU3RvcmVIZWFkZXJzLAogICAgICB9LAogICAgICB7CiAgICAgICAgc291cmNlOiAiL29uYm9hcmRpbmcvOnBhdGgqIiwKICAgICAgICBoZWFkZXJzOiBwcml2YXRlTm9TdG9yZUhlYWRlcnMsCiAgICAgIH0sCiAgICAgIHsKICAgICAgICBzb3VyY2U6ICIvbWluaGEtbG9qYS86cGF0aCoiLAogICAgICAgIGhlYWRlcnM6IHByaXZhdGVOb1N0b3JlSGVhZGVycywKICAgICAgfSwKICAgICAgewogICAgICAgIHNvdXJjZTogIi9hcGkvYWRtaW4vOnBhdGgqIiwKICAgICAgICBoZWFkZXJzOiBhcGlOb1N0b3JlSGVhZGVycywKICAgICAgfSwKICAgICAgewogICAgICAgIHNvdXJjZTogIi9hcGkvYXV0aC86cGF0aCoiLAogICAgICAgIGhlYWRlcnM6IGFwaU5vU3RvcmVIZWFkZXJzLAogICAgICB9LAogICAgICB7CiAgICAgICAgc291cmNlOiAiL2FwaS9zdXBlcmFkbWluLzpwYXRoKiIsCiAgICAgICAgaGVhZGVyczogYXBpTm9TdG9yZUhlYWRlcnMsCiAgICAgIH0sCiAgICAgIHsKICAgICAgICBzb3VyY2U6ICIvYXBpL2NsaWVudC86cGF0aCoiLAogICAgICAgIGhlYWRlcnM6IGFwaU5vU3RvcmVIZWFkZXJzLAogICAgICB9LAogICAgICB7CiAgICAgICAgc291cmNlOiAiL2FwaS9iaWxsaW5nLzpwYXRoKiIsCiAgICAgICAgaGVhZGVyczogYXBpTm9TdG9yZUhlYWRlcnMsCiAgICAgIH0sCiAgICBdCiAgfSwKfQoKZXhwb3J0IGRlZmF1bHQgbmV4dENvbmZpZwo=")
[System.IO.File]::WriteAllBytes(
  (Join-Path (Get-Location) "next.config.mjs"),
  $data
)

Write-Host "OK: CSP expandida e compativel com Google Identity"
Write-Host "OK: HSTS reforcado para 2 anos + includeSubDomains + preload"
Write-Host "OK: COOP configurado para preservar popup do Google"
Write-Host "OK: CORP, Origin-Agent-Cluster e politicas legadas adicionadas"
Write-Host "OK: no-store aplicado a paineis e APIs sensiveis"
Write-Host ""

Write-Host "Validando configuracao..."
node --input-type=module -e "import('./next.config.mjs').then(async m => { const h = await m.default.headers(); const all = h.find(x => x.source === '/:path*'); const csp = all.headers.find(x => x.key === 'Content-Security-Policy')?.value || ''; if (!csp.includes(`frame-src 'self' https://accounts.google.com`)) throw new Error('CSP sem Google Identity'); if (!csp.includes(`object-src 'none'`)) throw new Error('CSP incompleta'); if (!csp.includes(`frame-ancestors 'none'`)) throw new Error('anti-clickjacking ausente'); console.log('OK: configuracao de headers valida'); })"
if ($LASTEXITCODE -ne 0) {
  throw "Falha ao validar next.config.mjs."
}

Write-Host ""
Write-Host "Verificando diff..."
git diff --check
if ($LASTEXITCODE -ne 0) {
  throw "git diff --check encontrou problema."
}

Write-Host ""
Write-Host "Executando build..."
npm.cmd run build
$buildExit = $LASTEXITCODE

git restore -- next-env.d.ts 2>$null

if ($buildExit -ne 0) {
  throw "BUILD FALHOU. Envie apenas o erro final."
}

Write-Host ""
Write-Host "=============================================="
Write-Host "ETAPA 13.11 APLICADA - BUILD APROVADO"
Write-Host "=============================================="
Write-Host "- CSP completa aplicada globalmente"
Write-Host "- Google Identity permitido explicitamente"
Write-Host "- scripts de atributos inline bloqueados"
Write-Host "- object/embed bloqueados"
Write-Host "- framing externo bloqueado"
Write-Host "- HSTS reforcado"
Write-Host "- COOP/CORP e headers adicionais habilitados"
Write-Host "- paginas administrativas e APIs sensiveis sem cache"
Write-Host "- ainda nao foi feito commit nem deploy"

const fs = require("fs")
const path = require("path")

const MARKER = "SABORFLOW_BRANDING_CATEGORIES_V1"

if (!fs.existsSync("package.json")) {
  throw new Error("Execute este arquivo na raiz do projeto SaborFlow, onde existe package.json.")
}

const files = {
  types: path.join("lib", "types.ts"),
  settings: path.join("components", "admin", "settings-panel.tsx"),
  dashboard: path.join("components", "admin", "admin-dashboard.tsx"),
  storefront: path.join("components", "store", "storefront.tsx"),
  branding: path.join("components", "admin", "store-branding-editor.tsx"),
  categoryOrder: path.join("components", "admin", "category-order-panel.tsx"),
}

for (const key of ["types", "settings", "dashboard", "storefront"]) {
  if (!fs.existsSync(files[key])) {
    throw new Error(`Arquivo obrigatório não encontrado: ${files[key]}`)
  }
}

const read = (file) => fs.readFileSync(file, "utf8")
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, "utf8")
}
const backup = (file, content) => {
  const target = `${file}.bak-branding-categorias`
  if (!fs.existsSync(target)) fs.writeFileSync(target, content, "utf8")
}
function replaceOnce(text, oldText, newText, label) {
  const first = text.indexOf(oldText)
  if (first < 0) throw new Error(`${label}: trecho esperado não encontrado. Nenhum arquivo foi alterado.`)
  if (text.indexOf(oldText, first + oldText.length) >= 0) {
    throw new Error(`${label}: encontrei mais de um trecho possível. Nenhum arquivo foi alterado.`)
  }
  return text.slice(0, first) + newText + text.slice(first + oldText.length)
}

const original = {
  types: read(files.types),
  settings: read(files.settings),
  dashboard: read(files.dashboard),
  storefront: read(files.storefront),
}

if (
  original.types.includes(MARKER) &&
  original.settings.includes("@/components/admin/store-branding-editor") &&
  original.dashboard.includes("@/components/admin/category-order-panel")
) {
  console.log("Melhoria de branding e ordem de categorias já está aplicada.")
  process.exit(0)
}

let next = { ...original }

// 1) StoreSettings: usa o JSONB já existente, sem migration.
if (!next.types.includes("storeTitleMode?:")) {
  const anchor = "  logoImage: string"
  next.types = replaceOnce(
    next.types,
    anchor,
    `${anchor}
  /** ${MARKER} */
  storeTitleMode?: "text" | "logo"
  storeTitleFont?: "modern" | "rounded" | "elegant" | "impact"
  storeTitleColor?: string`,
    "Adicionar opções de identidade ao StoreSettings",
  )
}

const brandComponent = Buffer.from("InVzZSBjbGllbnQiCgppbXBvcnQgdHlwZSB7IENTU1Byb3BlcnRpZXMgfSBmcm9tICJyZWFjdCIKaW1wb3J0IHR5cGUgeyBTdG9yZVNldHRpbmdzIH0gZnJvbSAiQC9saWIvdHlwZXMiCgpjb25zdCBmb250T3B0aW9ucyA9IFsKICB7IHZhbHVlOiAibW9kZXJuIiwgbGFiZWw6ICJNb2Rlcm5hIiwgZmFtaWx5OiAidWktc2Fucy1zZXJpZiwgc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICdTZWdvZSBVSScsIHNhbnMtc2VyaWYiIH0sCiAgeyB2YWx1ZTogInJvdW5kZWQiLCBsYWJlbDogIkFycmVkb25kYWRhIiwgZmFtaWx5OiAiJ1RyZWJ1Y2hldCBNUycsICdBcmlhbCBSb3VuZGVkIE1UIEJvbGQnLCBBcmlhbCwgc2Fucy1zZXJpZiIgfSwKICB7IHZhbHVlOiAiZWxlZ2FudCIsIGxhYmVsOiAiRWxlZ2FudGUiLCBmYW1pbHk6ICJHZW9yZ2lhLCAnVGltZXMgTmV3IFJvbWFuJywgc2VyaWYiIH0sCiAgeyB2YWx1ZTogImltcGFjdCIsIGxhYmVsOiAiSW1wYWN0byIsIGZhbWlseTogIkltcGFjdCwgJ0FyaWFsIEJsYWNrJywgc2Fucy1zZXJpZiIgfSwKXSBhcyBjb25zdAoKZXhwb3J0IGZ1bmN0aW9uIFN0b3JlQnJhbmRpbmdFZGl0b3IoewogIHNldHRpbmdzLAogIG9uQ2hhbmdlLAp9OiB7CiAgc2V0dGluZ3M6IFN0b3JlU2V0dGluZ3MKICBvbkNoYW5nZTogKHNldHRpbmdzOiBTdG9yZVNldHRpbmdzKSA9PiB2b2lkCn0pIHsKICBjb25zdCBtb2RlID0gc2V0dGluZ3Muc3RvcmVUaXRsZU1vZGUgfHwgInRleHQiCiAgY29uc3QgZm9udCA9IHNldHRpbmdzLnN0b3JlVGl0bGVGb250IHx8ICJtb2Rlcm4iCiAgY29uc3QgY29sb3IgPSBzZXR0aW5ncy5zdG9yZVRpdGxlQ29sb3IgfHwgc2V0dGluZ3MucHJpbWFyeUNvbG9yIHx8ICIjMTExODI3IgogIGNvbnN0IHNlbGVjdGVkRm9udCA9IGZvbnRPcHRpb25zLmZpbmQoKGl0ZW0pID0+IGl0ZW0udmFsdWUgPT09IGZvbnQpIHx8IGZvbnRPcHRpb25zWzBdCiAgY29uc3QgcHJldmlld1N0eWxlID0geyBjb2xvciwgZm9udEZhbWlseTogc2VsZWN0ZWRGb250LmZhbWlseSB9IGFzIENTU1Byb3BlcnRpZXMKICBjb25zdCBjYW5Vc2VMb2dvID0gQm9vbGVhbihzZXR0aW5ncy5sb2dvSW1hZ2U/LnRyaW0oKSkKCiAgcmV0dXJuICgKICAgIDxzZWN0aW9uIGNsYXNzTmFtZT0icm91bmRlZC0yeGwgYm9yZGVyIGJvcmRlci1ncmF5LTIwMCBiZy13aGl0ZSBwLTUgc2hhZG93LXNtIj4KICAgICAgPGRpdiBjbGFzc05hbWU9Im1iLTUiPgogICAgICAgIDxwIGNsYXNzTmFtZT0idGV4dC14cyBmb250LWJsYWNrIHVwcGVyY2FzZSB0cmFja2luZy1bMC4xNmVtXSB0ZXh0LW9yYW5nZS02MDAiPklkZW50aWRhZGUgdmlzdWFsPC9wPgogICAgICAgIDxoMiBjbGFzc05hbWU9Im10LTEgdGV4dC1sZyBmb250LWJsYWNrIj5Ob21lIGRhIGVtcHJlc2Egbm8gY2FyZMOhcGlvIGUgcGVkaWRvczwvaDI+CiAgICAgICAgPHAgY2xhc3NOYW1lPSJtdC0xIHRleHQtc20gdGV4dC1ncmF5LTUwMCI+CiAgICAgICAgICBFc2NvbGhhIHNlIG8gY2xpZW50ZSB2ZXLDoSBvIG5vbWUgZW0gdGV4dG8gcGVyc29uYWxpemFkbyBvdSBhIGxvZ28gZGEgZW1wcmVzYS4KICAgICAgICA8L3A+CiAgICAgIDwvZGl2PgoKICAgICAgPGRpdiBjbGFzc05hbWU9ImdyaWQgZ2FwLTQgbGc6Z3JpZC1jb2xzLTMiPgogICAgICAgIDxsYWJlbD4KICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT0ibWItMS41IGJsb2NrIHRleHQteHMgZm9udC1ib2xkIHVwcGVyY2FzZSB0ZXh0LWdyYXktNTAwIj5FeGliacOnw6NvPC9zcGFuPgogICAgICAgICAgPHNlbGVjdAogICAgICAgICAgICBjbGFzc05hbWU9ImgtMTEgdy1mdWxsIHJvdW5kZWQteGwgYm9yZGVyIGJvcmRlci1ncmF5LTIwMCBiZy13aGl0ZSBweC0zIHRleHQtc20gZm9udC1zZW1pYm9sZCBvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLW9yYW5nZS0zMDAiCiAgICAgICAgICAgIHZhbHVlPXttb2RlfQogICAgICAgICAgICBvbkNoYW5nZT17KGV2ZW50KSA9PgogICAgICAgICAgICAgIG9uQ2hhbmdlKHsKICAgICAgICAgICAgICAgIC4uLnNldHRpbmdzLAogICAgICAgICAgICAgICAgc3RvcmVUaXRsZU1vZGU6IGV2ZW50LnRhcmdldC52YWx1ZSBhcyBTdG9yZVNldHRpbmdzWyJzdG9yZVRpdGxlTW9kZSJdLAogICAgICAgICAgICAgIH0pCiAgICAgICAgICAgIH0KICAgICAgICAgID4KICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT0idGV4dCI+Tm9tZSBlbSB0ZXh0bzwvb3B0aW9uPgogICAgICAgICAgICA8b3B0aW9uIHZhbHVlPSJsb2dvIj5Mb2dvIG5vIGx1Z2FyIGRvIG5vbWU8L29wdGlvbj4KICAgICAgICAgIDwvc2VsZWN0PgogICAgICAgIDwvbGFiZWw+CgogICAgICAgIDxsYWJlbD4KICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT0ibWItMS41IGJsb2NrIHRleHQteHMgZm9udC1ib2xkIHVwcGVyY2FzZSB0ZXh0LWdyYXktNTAwIj5Gb250ZSBkbyBub21lPC9zcGFuPgogICAgICAgICAgPHNlbGVjdAogICAgICAgICAgICBkaXNhYmxlZD17bW9kZSA9PT0gImxvZ28ifQogICAgICAgICAgICBjbGFzc05hbWU9ImgtMTEgdy1mdWxsIHJvdW5kZWQteGwgYm9yZGVyIGJvcmRlci1ncmF5LTIwMCBiZy13aGl0ZSBweC0zIHRleHQtc20gZm9udC1zZW1pYm9sZCBvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLW9yYW5nZS0zMDAgZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIGRpc2FibGVkOmJnLWdyYXktMTAwIGRpc2FibGVkOnRleHQtZ3JheS00MDAiCiAgICAgICAgICAgIHZhbHVlPXtmb250fQogICAgICAgICAgICBvbkNoYW5nZT17KGV2ZW50KSA9PgogICAgICAgICAgICAgIG9uQ2hhbmdlKHsKICAgICAgICAgICAgICAgIC4uLnNldHRpbmdzLAogICAgICAgICAgICAgICAgc3RvcmVUaXRsZUZvbnQ6IGV2ZW50LnRhcmdldC52YWx1ZSBhcyBTdG9yZVNldHRpbmdzWyJzdG9yZVRpdGxlRm9udCJdLAogICAgICAgICAgICAgIH0pCiAgICAgICAgICAgIH0KICAgICAgICAgID4KICAgICAgICAgICAge2ZvbnRPcHRpb25zLm1hcCgoaXRlbSkgPT4gKAogICAgICAgICAgICAgIDxvcHRpb24ga2V5PXtpdGVtLnZhbHVlfSB2YWx1ZT17aXRlbS52YWx1ZX0+e2l0ZW0ubGFiZWx9PC9vcHRpb24+CiAgICAgICAgICAgICkpfQogICAgICAgICAgPC9zZWxlY3Q+CiAgICAgICAgPC9sYWJlbD4KCiAgICAgICAgPGxhYmVsPgogICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPSJtYi0xLjUgYmxvY2sgdGV4dC14cyBmb250LWJvbGQgdXBwZXJjYXNlIHRleHQtZ3JheS01MDAiPkNvciBkbyBub21lPC9zcGFuPgogICAgICAgICAgPGRpdiBjbGFzc05hbWU9ImZsZXggaC0xMSBpdGVtcy1jZW50ZXIgZ2FwLTIgcm91bmRlZC14bCBib3JkZXIgYm9yZGVyLWdyYXktMjAwIGJnLXdoaXRlIHB4LTIiPgogICAgICAgICAgICA8aW5wdXQKICAgICAgICAgICAgICB0eXBlPSJjb2xvciIKICAgICAgICAgICAgICBkaXNhYmxlZD17bW9kZSA9PT0gImxvZ28ifQogICAgICAgICAgICAgIHZhbHVlPXsvXiNbMC05YS1mXXs2fSQvaS50ZXN0KGNvbG9yKSA/IGNvbG9yIDogIiMxMTE4MjcifQogICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZXZlbnQpID0+IG9uQ2hhbmdlKHsgLi4uc2V0dGluZ3MsIHN0b3JlVGl0bGVDb2xvcjogZXZlbnQudGFyZ2V0LnZhbHVlIH0pfQogICAgICAgICAgICAgIGNsYXNzTmFtZT0iaC04IHctMTAgY3Vyc29yLXBvaW50ZXIgcm91bmRlZCBib3JkZXItMCBiZy10cmFuc3BhcmVudCBwLTAgZGlzYWJsZWQ6Y3Vyc29yLW5vdC1hbGxvd2VkIgogICAgICAgICAgICAgIGFyaWEtbGFiZWw9IkNvciBkbyBub21lIGRhIGVtcHJlc2EiCiAgICAgICAgICAgIC8+CiAgICAgICAgICAgIDxpbnB1dAogICAgICAgICAgICAgIGRpc2FibGVkPXttb2RlID09PSAibG9nbyJ9CiAgICAgICAgICAgICAgdmFsdWU9e2NvbG9yfQogICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZXZlbnQpID0+IG9uQ2hhbmdlKHsgLi4uc2V0dGluZ3MsIHN0b3JlVGl0bGVDb2xvcjogZXZlbnQudGFyZ2V0LnZhbHVlIH0pfQogICAgICAgICAgICAgIGNsYXNzTmFtZT0ibWluLXctMCBmbGV4LTEgYmctdHJhbnNwYXJlbnQgdGV4dC1zbSBmb250LXNlbWlib2xkIHVwcGVyY2FzZSBvdXRsaW5lLW5vbmUgZGlzYWJsZWQ6dGV4dC1ncmF5LTQwMCIKICAgICAgICAgICAgICBtYXhMZW5ndGg9ezE2fQogICAgICAgICAgICAgIHBsYWNlaG9sZGVyPSIjMTExODI3IgogICAgICAgICAgICAvPgogICAgICAgICAgPC9kaXY+CiAgICAgICAgPC9sYWJlbD4KICAgICAgPC9kaXY+CgogICAgICA8ZGl2IGNsYXNzTmFtZT0ibXQtNSByb3VuZGVkLTJ4bCBib3JkZXIgYm9yZGVyLWRhc2hlZCBib3JkZXItZ3JheS0zMDAgYmctZ3JheS01MCBwLTQiPgogICAgICAgIDxkaXYgY2xhc3NOYW1lPSJtYi0zIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBnYXAtMyI+CiAgICAgICAgICA8ZGl2PgogICAgICAgICAgICA8cCBjbGFzc05hbWU9InRleHQteHMgZm9udC1ibGFjayB1cHBlcmNhc2UgdHJhY2tpbmctWzAuMTRlbV0gdGV4dC1ncmF5LTUwMCI+UHLDqXZpYTwvcD4KICAgICAgICAgICAgPHAgY2xhc3NOYW1lPSJ0ZXh0LXhzIHRleHQtZ3JheS00MDAiPlZpc3VhbCBhcHJveGltYWRvIGRvIGNhYmXDp2FsaG8gcGFyYSBvIGNsaWVudGUuPC9wPgogICAgICAgICAgPC9kaXY+CiAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9InJvdW5kZWQtZnVsbCBiZy13aGl0ZSBweC0yLjUgcHktMSB0ZXh0LVsxMHB4XSBmb250LWJsYWNrIHVwcGVyY2FzZSB0ZXh0LWdyYXktNTAwIHNoYWRvdy1zbSI+CiAgICAgICAgICAgIHttb2RlID09PSAibG9nbyIgPyAiTG9nbyIgOiBzZWxlY3RlZEZvbnQubGFiZWx9CiAgICAgICAgICA8L3NwYW4+CiAgICAgICAgPC9kaXY+CgogICAgICAgIDxkaXYgY2xhc3NOYW1lPSJmbGV4IG1pbi1oLTIwIGl0ZW1zLWNlbnRlciByb3VuZGVkLTJ4bCBib3JkZXIgYm9yZGVyLWdyYXktMjAwIGJnLXdoaXRlIHB4LTUgcHktNCBzaGFkb3ctc20iPgogICAgICAgICAge21vZGUgPT09ICJsb2dvIiAmJiBjYW5Vc2VMb2dvID8gKAogICAgICAgICAgICA8aW1nIHNyYz17c2V0dGluZ3MubG9nb0ltYWdlfSBhbHQ9e3NldHRpbmdzLnN0b3JlTmFtZX0gY2xhc3NOYW1lPSJtYXgtaC0xNiBtYXgtdy1bMjgwcHhdIG9iamVjdC1jb250YWluIiAvPgogICAgICAgICAgKSA6ICgKICAgICAgICAgICAgPGRpdj4KICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0iYnJlYWstd29yZHMgdGV4dC0zeGwgZm9udC1ibGFjayBsZWFkaW5nLXRpZ2h0IiBzdHlsZT17cHJldmlld1N0eWxlfT4KICAgICAgICAgICAgICAgIHtzZXR0aW5ncy5zdG9yZU5hbWUgfHwgIk5vbWUgZGEgZW1wcmVzYSJ9CiAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgICAge21vZGUgPT09ICJsb2dvIiAmJiAhY2FuVXNlTG9nbyA/ICgKICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT0ibXQtMiB0ZXh0LXhzIGZvbnQtc2VtaWJvbGQgdGV4dC1hbWJlci03MDAiPgogICAgICAgICAgICAgICAgICBOZW5odW1hIGxvZ28gZXN0w6EgY2FkYXN0cmFkYS4gRW5xdWFudG8gaXNzbywgbyBub21lIGNvbnRpbnVhcsOhIGFwYXJlY2VuZG8uCiAgICAgICAgICAgICAgICA8L3A+CiAgICAgICAgICAgICAgKSA6IG51bGx9CiAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgKX0KICAgICAgICA8L2Rpdj4KICAgICAgPC9kaXY+CgogICAgICA8cCBjbGFzc05hbWU9Im10LTQgdGV4dC14cyB0ZXh0LWdyYXktNTAwIj4KICAgICAgICBBIGxvZ28gdXRpbGl6YWRhIMOpIGEgbWVzbWEgasOhIGNhZGFzdHJhZGEgbmFzIGNvbmZpZ3VyYcOnw7VlcyBkYSBlbXByZXNhLiBEZXBvaXMgZGUgZXNjb2xoZXIgYSBhcGFyw6puY2lhLCB1c2UgbyBib3TDo28gZGUgc2FsdmFyIGRhcyBjb25maWd1cmHDp8O1ZXMuCiAgICAgIDwvcD4KICAgIDwvc2VjdGlvbj4KICApCn0K", "base64").toString("utf8")
const categoryOrderComponent = Buffer.from("InVzZSBjbGllbnQiCgppbXBvcnQgeyB1c2VFZmZlY3QsIHVzZU1lbW8sIHVzZVN0YXRlIH0gZnJvbSAicmVhY3QiCmltcG9ydCB7IEFycm93RG93biwgQXJyb3dVcCwgR3JpcFZlcnRpY2FsLCBMb2FkZXIyIH0gZnJvbSAibHVjaWRlLXJlYWN0IgppbXBvcnQgdHlwZSB7IENhdGVnb3J5IH0gZnJvbSAiQC9saWIvdHlwZXMiCgpmdW5jdGlvbiBvcmRlcmVkQ2F0ZWdvcmllcyhjYXRlZ29yaWVzOiBDYXRlZ29yeVtdKSB7CiAgcmV0dXJuIFsuLi5jYXRlZ29yaWVzXS5zb3J0KAogICAgKGEsIGIpID0+CiAgICAgIE51bWJlcihhLnNvcnRPcmRlciB8fCAwKSAtIE51bWJlcihiLnNvcnRPcmRlciB8fCAwKSB8fAogICAgICBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUsICJwdC1CUiIpIHx8CiAgICAgIGEuaWQgLSBiLmlkLAogICkKfQoKZXhwb3J0IGZ1bmN0aW9uIENhdGVnb3J5T3JkZXJQYW5lbCh7CiAgY2F0ZWdvcmllcywKICBvbkNhdGVnb3JpZXNDaGFuZ2VkLAp9OiB7CiAgY2F0ZWdvcmllczogQ2F0ZWdvcnlbXQogIG9uQ2F0ZWdvcmllc0NoYW5nZWQ6IChjYXRlZ29yaWVzOiBDYXRlZ29yeVtdKSA9PiB2b2lkCn0pIHsKICBjb25zdCBzb3J0ZWRGcm9tUHJvcHMgPSB1c2VNZW1vKCgpID0+IG9yZGVyZWRDYXRlZ29yaWVzKGNhdGVnb3JpZXMpLCBbY2F0ZWdvcmllc10pCiAgY29uc3QgW29yZGVyLCBzZXRPcmRlcl0gPSB1c2VTdGF0ZTxDYXRlZ29yeVtdPihzb3J0ZWRGcm9tUHJvcHMpCiAgY29uc3QgW2J1c3ksIHNldEJ1c3ldID0gdXNlU3RhdGUoZmFsc2UpCiAgY29uc3QgW21lc3NhZ2UsIHNldE1lc3NhZ2VdID0gdXNlU3RhdGUoIiIpCiAgY29uc3QgW2RyYWdnZWRJZCwgc2V0RHJhZ2dlZElkXSA9IHVzZVN0YXRlPG51bWJlciB8IG51bGw+KG51bGwpCgogIHVzZUVmZmVjdCgoKSA9PiB7CiAgICBpZiAoIWJ1c3kpIHNldE9yZGVyKHNvcnRlZEZyb21Qcm9wcykKICB9LCBbc29ydGVkRnJvbVByb3BzLCBidXN5XSkKCiAgYXN5bmMgZnVuY3Rpb24gc2F2ZU9yZGVyKG5leHRPcmRlcjogQ2F0ZWdvcnlbXSkgewogICAgaWYgKGJ1c3kpIHJldHVybgoKICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBuZXh0T3JkZXIubWFwKChpdGVtLCBpbmRleCkgPT4gKHsKICAgICAgLi4uaXRlbSwKICAgICAgc29ydE9yZGVyOiBpbmRleCArIDEsCiAgICB9KSkKCiAgICBzZXRPcmRlcihub3JtYWxpemVkKQogICAgc2V0QnVzeSh0cnVlKQogICAgc2V0TWVzc2FnZSgiU2FsdmFuZG8gbm92YSBvcmRlbS4uLiIpCgogICAgdHJ5IHsKICAgICAgZm9yIChjb25zdCBpdGVtIG9mIG5vcm1hbGl6ZWQpIHsKICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKAogICAgICAgICAgYC9hcGkvY2F0ZWdvcmllcy8ke2VuY29kZVVSSUNvbXBvbmVudChTdHJpbmcoaXRlbS5pZCkpfWAsCiAgICAgICAgICB7CiAgICAgICAgICAgIG1ldGhvZDogIlBBVENIIiwKICAgICAgICAgICAgaGVhZGVyczogeyAiQ29udGVudC1UeXBlIjogImFwcGxpY2F0aW9uL2pzb24iIH0sCiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgc29ydE9yZGVyOiBpdGVtLnNvcnRPcmRlciB9KSwKICAgICAgICAgIH0sCiAgICAgICAgKQogICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSkKICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7CiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoCiAgICAgICAgICAgIGRhdGEuZXJyb3IgfHwgYE7Do28gZm9pIHBvc3PDrXZlbCByZXBvc2ljaW9uYXIgYSBjYXRlZ29yaWEgJHtpdGVtLm5hbWV9LmAsCiAgICAgICAgICApCiAgICAgICAgfQogICAgICB9CgogICAgICBvbkNhdGVnb3JpZXNDaGFuZ2VkKG5vcm1hbGl6ZWQpCiAgICAgIHNldE1lc3NhZ2UoIk9yZGVtIHNhbHZhLiBPIGNhcmTDoXBpbyBzZWd1aXLDoSBlc3RhIHNlcXXDqm5jaWEuIikKICAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICAgIHNldE1lc3NhZ2UoCiAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvcgogICAgICAgICAgPyBlcnJvci5tZXNzYWdlCiAgICAgICAgICA6ICJOw6NvIGZvaSBwb3Nzw612ZWwgc2FsdmFyIGEgb3JkZW0gZGFzIGNhdGVnb3JpYXMuIiwKICAgICAgKQogICAgfSBmaW5hbGx5IHsKICAgICAgc2V0QnVzeShmYWxzZSkKICAgIH0KICB9CgogIGZ1bmN0aW9uIG1vdmUoaW5kZXg6IG51bWJlciwgZGlyZWN0aW9uOiAtMSB8IDEpIHsKICAgIGNvbnN0IHRhcmdldCA9IGluZGV4ICsgZGlyZWN0aW9uCiAgICBpZiAoYnVzeSB8fCB0YXJnZXQgPCAwIHx8IHRhcmdldCA+PSBvcmRlci5sZW5ndGgpIHJldHVybgoKICAgIGNvbnN0IG5leHQgPSBbLi4ub3JkZXJdCiAgICA7W25leHRbaW5kZXhdLCBuZXh0W3RhcmdldF1dID0gW25leHRbdGFyZ2V0XSwgbmV4dFtpbmRleF1dCiAgICB2b2lkIHNhdmVPcmRlcihuZXh0KQogIH0KCiAgZnVuY3Rpb24gZHJvcE9uKHRhcmdldElkOiBudW1iZXIpIHsKICAgIGlmIChidXN5IHx8IGRyYWdnZWRJZCA9PT0gbnVsbCB8fCBkcmFnZ2VkSWQgPT09IHRhcmdldElkKSB7CiAgICAgIHNldERyYWdnZWRJZChudWxsKQogICAgICByZXR1cm4KICAgIH0KCiAgICBjb25zdCBmcm9tID0gb3JkZXIuZmluZEluZGV4KChpdGVtKSA9PiBpdGVtLmlkID09PSBkcmFnZ2VkSWQpCiAgICBjb25zdCB0byA9IG9yZGVyLmZpbmRJbmRleCgoaXRlbSkgPT4gaXRlbS5pZCA9PT0gdGFyZ2V0SWQpCiAgICBpZiAoZnJvbSA8IDAgfHwgdG8gPCAwKSB7CiAgICAgIHNldERyYWdnZWRJZChudWxsKQogICAgICByZXR1cm4KICAgIH0KCiAgICBjb25zdCBuZXh0ID0gWy4uLm9yZGVyXQogICAgY29uc3QgW21vdmVkXSA9IG5leHQuc3BsaWNlKGZyb20sIDEpCiAgICBuZXh0LnNwbGljZSh0bywgMCwgbW92ZWQpCiAgICBzZXREcmFnZ2VkSWQobnVsbCkKICAgIHZvaWQgc2F2ZU9yZGVyKG5leHQpCiAgfQoKICByZXR1cm4gKAogICAgPHNlY3Rpb24gY2xhc3NOYW1lPSJyb3VuZGVkLTJ4bCBib3JkZXIgYm9yZGVyLWdyYXktMjAwIGJnLXdoaXRlIHAtNSBzaGFkb3ctc20iPgogICAgICA8ZGl2IGNsYXNzTmFtZT0iZmxleCBmbGV4LWNvbCBnYXAtMyBzbTpmbGV4LXJvdyBzbTppdGVtcy1zdGFydCBzbTpqdXN0aWZ5LWJldHdlZW4iPgogICAgICAgIDxkaXY+CiAgICAgICAgICA8cCBjbGFzc05hbWU9InRleHQteHMgZm9udC1ibGFjayB1cHBlcmNhc2UgdHJhY2tpbmctWzAuMTZlbV0gdGV4dC1vcmFuZ2UtNjAwIj5PcmRlbSBubyBjYXJkw6FwaW88L3A+CiAgICAgICAgICA8aDIgY2xhc3NOYW1lPSJtdC0xIHRleHQtbGcgZm9udC1ibGFjayI+T3JnYW5pemFyIGNhdGVnb3JpYXM8L2gyPgogICAgICAgICAgPHAgY2xhc3NOYW1lPSJtdC0xIG1heC13LTJ4bCB0ZXh0LXNtIHRleHQtZ3JheS01MDAiPgogICAgICAgICAgICBBcnJhc3RlIGFzIGNhdGVnb3JpYXMgb3UgdXNlIGFzIHNldGFzLiBBIHByaW1laXJhIGRlc3RhIGxpc3RhIHNlcsOhIGEgcHJpbWVpcmEgY2F0ZWdvcmlhIGV4aWJpZGEgcGFyYSBvIGNsaWVudGUsIGluZGVwZW5kZW50ZW1lbnRlIGRhIG9yZGVtIGVtIHF1ZSBlbGEgZm9pIGNhZGFzdHJhZGEuCiAgICAgICAgICA8L3A+CiAgICAgICAgPC9kaXY+CiAgICAgICAge2J1c3kgPyAoCiAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9ImlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiByb3VuZGVkLWZ1bGwgYmctb3JhbmdlLTUwIHB4LTMgcHktMS41IHRleHQteHMgZm9udC1ibGFjayB0ZXh0LW9yYW5nZS03MDAiPgogICAgICAgICAgICA8TG9hZGVyMiBjbGFzc05hbWU9ImgtMy41IHctMy41IGFuaW1hdGUtc3BpbiIgLz4KICAgICAgICAgICAgU2FsdmFuZG8KICAgICAgICAgIDwvc3Bhbj4KICAgICAgICApIDogbnVsbH0KICAgICAgPC9kaXY+CgogICAgICA8ZGl2IGNsYXNzTmFtZT0ibXQtNSBzcGFjZS15LTIiPgogICAgICAgIHtvcmRlci5tYXAoKGNhdGVnb3J5LCBpbmRleCkgPT4gKAogICAgICAgICAgPGRpdgogICAgICAgICAgICBrZXk9e2NhdGVnb3J5LmlkfQogICAgICAgICAgICBkcmFnZ2FibGU9eyFidXN5fQogICAgICAgICAgICBvbkRyYWdTdGFydD17KCkgPT4gc2V0RHJhZ2dlZElkKGNhdGVnb3J5LmlkKX0KICAgICAgICAgICAgb25EcmFnRW5kPXsoKSA9PiBzZXREcmFnZ2VkSWQobnVsbCl9CiAgICAgICAgICAgIG9uRHJhZ092ZXI9eyhldmVudCkgPT4gZXZlbnQucHJldmVudERlZmF1bHQoKX0KICAgICAgICAgICAgb25Ecm9wPXsoKSA9PiBkcm9wT24oY2F0ZWdvcnkuaWQpfQogICAgICAgICAgICBjbGFzc05hbWU9e2BmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyByb3VuZGVkLXhsIGJvcmRlciBiZy13aGl0ZSBwLTMgdHJhbnNpdGlvbiAkewogICAgICAgICAgICAgIGRyYWdnZWRJZCA9PT0gY2F0ZWdvcnkuaWQKICAgICAgICAgICAgICAgID8gImJvcmRlci1vcmFuZ2UtMzAwIG9wYWNpdHktNjAiCiAgICAgICAgICAgICAgICA6ICJib3JkZXItZ3JheS0yMDAiCiAgICAgICAgICAgIH1gfQogICAgICAgICAgPgogICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0iaGlkZGVuIGN1cnNvci1ncmFiIHRleHQtZ3JheS0zMDAgYWN0aXZlOmN1cnNvci1ncmFiYmluZyBzbTpibG9jayIgdGl0bGU9IkFycmFzdGUgcGFyYSByZW9yZ2FuaXphciI+CiAgICAgICAgICAgICAgPEdyaXBWZXJ0aWNhbCBjbGFzc05hbWU9ImgtNSB3LTUiIC8+CiAgICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9ImZsZXggaC05IHctOSBzaHJpbmstMCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC14bCBiZy1ncmF5LTk1MCB0ZXh0LXhzIGZvbnQtYmxhY2sgdGV4dC13aGl0ZSI+CiAgICAgICAgICAgICAge2luZGV4ICsgMX0KICAgICAgICAgICAgPC9kaXY+CgogICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0ibWluLXctMCBmbGV4LTEiPgogICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT0idHJ1bmNhdGUgdGV4dC1zbSBmb250LWJsYWNrIHRleHQtZ3JheS05NTAiPntjYXRlZ29yeS5uYW1lfTwvcD4KICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9InRleHQteHMgdGV4dC1ncmF5LTUwMCI+CiAgICAgICAgICAgICAgICB7Y2F0ZWdvcnkuYWN0aXZlID8gIlZpc8OtdmVsIG5vIGNhcmTDoXBpbyIgOiAiQ2F0ZWdvcmlhIGRlc2F0aXZhZGEifQogICAgICAgICAgICAgIDwvcD4KICAgICAgICAgICAgPC9kaXY+CgogICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0iZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTEiPgogICAgICAgICAgICAgIDxidXR0b24KICAgICAgICAgICAgICAgIHR5cGU9ImJ1dHRvbiIKICAgICAgICAgICAgICAgIGRpc2FibGVkPXtidXN5IHx8IGluZGV4ID09PSAwfQogICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gbW92ZShpbmRleCwgLTEpfQogICAgICAgICAgICAgICAgY2xhc3NOYW1lPSJmbGV4IGgtOSB3LTkgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbGcgYm9yZGVyIGJvcmRlci1ncmF5LTIwMCB0ZXh0LWdyYXktNjAwIHRyYW5zaXRpb24gaG92ZXI6YmctZ3JheS01MCBkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6b3BhY2l0eS0zMCIKICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9e2BNb3ZlciAke2NhdGVnb3J5Lm5hbWV9IHBhcmEgY2ltYWB9CiAgICAgICAgICAgICAgICB0aXRsZT0iTW92ZXIgcGFyYSBjaW1hIgogICAgICAgICAgICAgID4KICAgICAgICAgICAgICAgIDxBcnJvd1VwIGNsYXNzTmFtZT0iaC00IHctNCIgLz4KICAgICAgICAgICAgICA8L2J1dHRvbj4KICAgICAgICAgICAgICA8YnV0dG9uCiAgICAgICAgICAgICAgICB0eXBlPSJidXR0b24iCiAgICAgICAgICAgICAgICBkaXNhYmxlZD17YnVzeSB8fCBpbmRleCA9PT0gb3JkZXIubGVuZ3RoIC0gMX0KICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IG1vdmUoaW5kZXgsIDEpfQogICAgICAgICAgICAgICAgY2xhc3NOYW1lPSJmbGV4IGgtOSB3LTkgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbGcgYm9yZGVyIGJvcmRlci1ncmF5LTIwMCB0ZXh0LWdyYXktNjAwIHRyYW5zaXRpb24gaG92ZXI6YmctZ3JheS01MCBkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6b3BhY2l0eS0zMCIKICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9e2BNb3ZlciAke2NhdGVnb3J5Lm5hbWV9IHBhcmEgYmFpeG9gfQogICAgICAgICAgICAgICAgdGl0bGU9Ik1vdmVyIHBhcmEgYmFpeG8iCiAgICAgICAgICAgICAgPgogICAgICAgICAgICAgICAgPEFycm93RG93biBjbGFzc05hbWU9ImgtNCB3LTQiIC8+CiAgICAgICAgICAgICAgPC9idXR0b24+CiAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgPC9kaXY+CiAgICAgICAgKSl9CgogICAgICAgIHtvcmRlci5sZW5ndGggPT09IDAgPyAoCiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0icm91bmRlZC14bCBib3JkZXIgYm9yZGVyLWRhc2hlZCBib3JkZXItZ3JheS0zMDAgcHgtNCBweS04IHRleHQtY2VudGVyIHRleHQtc20gdGV4dC1ncmF5LTUwMCI+CiAgICAgICAgICAgIENhZGFzdHJlIHVtYSBjYXRlZ29yaWEgcGFyYSBjb21lw6dhciBhIG9yZ2FuaXphciBhIG9yZGVtLgogICAgICAgICAgPC9kaXY+CiAgICAgICAgKSA6IG51bGx9CiAgICAgIDwvZGl2PgoKICAgICAge21lc3NhZ2UgPyAoCiAgICAgICAgPHAKICAgICAgICAgIGNsYXNzTmFtZT17YG10LTQgdGV4dC1zbSBmb250LXNlbWlib2xkICR7CiAgICAgICAgICAgIG1lc3NhZ2Uuc3RhcnRzV2l0aCgiT3JkZW0gc2FsdmEiKQogICAgICAgICAgICAgID8gInRleHQtZW1lcmFsZC03MDAiCiAgICAgICAgICAgICAgOiBtZXNzYWdlLnN0YXJ0c1dpdGgoIlNhbHZhbmRvIikKICAgICAgICAgICAgICAgID8gInRleHQtb3JhbmdlLTcwMCIKICAgICAgICAgICAgICAgIDogInRleHQtcmVkLTYwMCIKICAgICAgICAgIH1gfQogICAgICAgID4KICAgICAgICAgIHttZXNzYWdlfQogICAgICAgIDwvcD4KICAgICAgKSA6IG51bGx9CiAgICA8L3NlY3Rpb24+CiAgKQp9Cg==", "base64").toString("utf8")

// 2) Editor visual dentro de Configurações da loja.
if (!next.settings.includes("@/components/admin/store-branding-editor")) {
  const importAnchor = 'import { DeliverySettings } from "@/components/admin/delivery-settings"'
  next.settings = replaceOnce(
    next.settings,
    importAnchor,
    `${importAnchor}
import { StoreBrandingEditor } from "@/components/admin/store-branding-editor"`,
    "Importar editor de identidade visual",
  )
}

if (!next.settings.includes("<StoreBrandingEditor settings={draft}")) {
  const heading = "Redes sociais e links públicos"
  const headingIndex = next.settings.indexOf(heading)
  if (headingIndex < 0) throw new Error("Não encontrei a seção de redes sociais. Nenhum arquivo foi alterado.")
  const sectionIndex = next.settings.lastIndexOf("<section", headingIndex)
  if (sectionIndex < 0) throw new Error("Não encontrei o início da seção de redes sociais. Nenhum arquivo foi alterado.")
  next.settings =
    next.settings.slice(0, sectionIndex) +
    `<StoreBrandingEditor settings={draft} onChange={setDraft} />\n      ` +
    next.settings.slice(sectionIndex)
}

// 3) Cardápio/pedidos: aplica fonte/cor ou troca o nome pela logo.
if (!next.storefront.includes("const brandFontFamily =")) {
  const themeAnchor =
    '  const themeStyle = { "--primary": settings.primaryColor, "--secondary": settings.secondaryColor, "--store-bg": settings.backgroundColor } as React.CSSProperties'

  const runtime = `${themeAnchor}

  const brandFontFamily =
    ({
      modern: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      rounded: "'Trebuchet MS', 'Arial Rounded MT Bold', Arial, sans-serif",
      elegant: "Georgia, 'Times New Roman', serif",
      impact: "Impact, 'Arial Black', sans-serif",
    } as const)[settings.storeTitleFont || "modern"]

  const brandTextStyle = {
    color: settings.storeTitleColor || settings.primaryColor || "#111827",
    fontFamily: brandFontFamily,
  } as React.CSSProperties

  const showBrandTitleLogo =
    settings.storeTitleMode === "logo" &&
    Boolean(settings.logoImage?.trim())`

  next.storefront = replaceOnce(
    next.storefront,
    themeAnchor,
    runtime,
    "Adicionar estilo de identidade ao cardápio",
  )
}

const topTitle = '<span className="hidden truncate sm:inline">{settings.storeName}</span>'
if (next.storefront.includes(topTitle)) {
  next.storefront = replaceOnce(
    next.storefront,
    topTitle,
    `{showBrandTitleLogo ? (
              <img
                src={settings.logoImage}
                alt={settings.storeName}
                className="hidden max-h-8 max-w-[180px] object-contain sm:block"
              />
            ) : (
              <span
                className="hidden truncate text-base font-black sm:inline"
                style={brandTextStyle}
              >
                {settings.storeName}
              </span>
            )}`,
    "Personalizar nome no topo do cardápio",
  )
}

const mainTitle =
  '<h1 className="max-w-full break-words text-2xl font-black leading-tight tracking-tight sm:text-3xl">{settings.storeName}</h1>'
if (next.storefront.includes(mainTitle)) {
  next.storefront = replaceOnce(
    next.storefront,
    mainTitle,
    `{showBrandTitleLogo ? (
                  <img
                    src={settings.logoImage}
                    alt={settings.storeName}
                    className="max-h-16 max-w-[280px] object-contain sm:max-h-20 sm:max-w-[360px]"
                  />
                ) : (
                  <h1
                    className="max-w-full break-words text-2xl font-black leading-tight tracking-tight sm:text-3xl"
                    style={brandTextStyle}
                  >
                    {settings.storeName}
                  </h1>
                )}`,
    "Personalizar nome principal do cardápio",
  )
} else if (!next.storefront.includes("showBrandTitleLogo ? (")) {
  throw new Error("Não encontrei o título atual da empresa no storefront. Nenhum arquivo foi alterado.")
}

// 4) Painel de ordenação sem substituir o cadastro atual de categorias.
if (!next.dashboard.includes("@/components/admin/category-order-panel")) {
  const importAnchor = 'import { CategoriesPanel } from "@/components/admin/categories-panel"'
  next.dashboard = replaceOnce(
    next.dashboard,
    importAnchor,
    `${importAnchor}
import { CategoryOrderPanel } from "@/components/admin/category-order-panel"`,
    "Importar painel de ordem das categorias",
  )
}

if (!next.dashboard.includes("<CategoryOrderPanel")) {
  const categoryRender =
    '{section === "categories" && <CategoriesPanel categories={categories} onCategoriesChanged={setCategories} />}'
  next.dashboard = replaceOnce(
    next.dashboard,
    categoryRender,
    `{section === "categories" && (
            <div className="space-y-6">
              <CategoriesPanel categories={categories} onCategoriesChanged={setCategories} />
              <CategoryOrderPanel categories={categories} onCategoriesChanged={setCategories} />
            </div>
          )}`,
    "Adicionar reordenação à seção de categorias",
  )
}

const checks = [
  [next.types, "storeTitleMode?:", "tipos de branding"],
  [next.settings, "StoreBrandingEditor", "editor no admin"],
  [next.storefront, "brandFontFamily", "branding no storefront"],
  [next.storefront, "showBrandTitleLogo", "logo no título"],
  [next.dashboard, "CategoryOrderPanel", "ordem no dashboard"],
]
for (const [content, signal, label] of checks) {
  if (!content.includes(signal)) {
    throw new Error(`Validação falhou: ${label}. Nenhum arquivo foi alterado.`)
  }
}

for (const [key, content] of Object.entries(original)) backup(files[key], content)
write(files.types, next.types)
write(files.settings, next.settings)
write(files.dashboard, next.dashboard)
write(files.storefront, next.storefront)
write(files.branding, brandComponent)
write(files.categoryOrder, categoryOrderComponent)

console.log("")
console.log("=== MELHORIA APLICADA ===")
console.log("Identidade: texto/logo, 4 fontes, cor e prévia.")
console.log("Categorias: arrastar ou usar setas; ordem salva automaticamente.")
console.log("Nenhuma migration foi criada.")
console.log("")
console.log("Agora execute: npm run build")
console.log("")

export const BASIC_TRIAL_DAYS = 7
export const businessSegments = ["Salgados e festas", "Lanchonete", "Hamburgueria", "Pizzaria", "Restaurante e marmitaria", "Açaí e sorveteria", "Padaria e confeitaria", "Outro negócio de alimentação"] as const
export const systemExperiences = ["Nunca usei um sistema", "Uso planilha ou caderno", "Já uso outro sistema"] as const
export const dailyOrderRanges = ["Estou começando", "Até 10 pedidos", "De 11 a 50 pedidos", "Mais de 50 pedidos"] as const
export type BasicTrialProfile = { storeName: string; segment: string; experience: string; dailyOrders: string }
export function parseBasicTrialProfile(input: unknown): BasicTrialProfile {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Preencha as informações do seu negócio.")
  const value = input as Record<string, unknown>
  const storeName = typeof value.storeName === "string" ? value.storeName.trim() : ""
  if (storeName.length < 2 || storeName.length > 80) throw new Error("O nome da loja deve ter de 2 a 80 caracteres.")
  const select = (key: string, choices: readonly string[]) => {
    if (typeof value[key] !== "string" || !choices.includes(value[key])) throw new Error("Selecione o ramo, sua experiência e a quantidade de pedidos.")
    return value[key] as string
  }
  return { storeName, segment: select("segment", businessSegments), experience: select("experience", systemExperiences), dailyOrders: select("dailyOrders", dailyOrderRanges) }
}
export const basicTrialEntitlements = {
  maxOrganizations: 1, maxUsers: 1, maxProducts: 30,
  customDomain: false, delivery: true, kitchen: true, financial: true,
  loyalty: false, modifiers: true, inventory: false, advancedReports: false,
  integrations: false, aiSetup: false,
}
export const basicTrialSections = ["overview", "orders", "pdv", "kitchen", "sales", "products", "categories", "customers", "links", "settings", "security", "billing"] as const

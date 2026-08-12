import {
  BarChart3,
  Boxes,
  Building2,
  ChefHat,
  CircleDollarSign,
  ClipboardList,
  PackageCheck,
  ShoppingBag,
  Truck,
  UsersRound,
  UtensilsCrossed,
} from "lucide-react"

const icons = {
  orders: ClipboardList,
  pos: ShoppingBag,
  kitchen: ChefHat,
  delivery: Truck,
  modifiers: UtensilsCrossed,
  inventory: Boxes,
  financial: CircleDollarSign,
  customers: UsersRound,
  multi: Building2,
  reports: BarChart3,
  package: PackageCheck,
} as const

export type MarketingIconName = keyof typeof icons

export function MarketingIcon({ name, className = "h-5 w-5" }: { name: MarketingIconName; className?: string }) {
  const Icon = icons[name]
  return <Icon className={className} />
}

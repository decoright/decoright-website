import type { JSX } from "react"

export type SideNavItem = {
  id: string
  label: string
  key?: string
  description?: string
  icon?: JSX.Element | null
  path?: string     // leaf
  children?: SideNavItem[]  // nested
}

import type { Component } from 'vue'
import {
  TrendingUp,
  CreditCard,
  LayoutDashboard,
  Layers,
  Package,
  Settings,
  ShoppingBag,
  Star,
  Tag,
  UserCheck,
  Users,
  Boxes,
  User,
  Sparkles,
} from '@lucide/vue'

export interface NavItem {
  label: string
  to: string
  icon: Component
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', to: '/', icon: LayoutDashboard },
      { label: 'Analytics', to: '/analytics', icon: TrendingUp },
      { label: 'Chart Bot', to: '/chart-bot', icon: Sparkles },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { label: 'Products', to: '/products', icon: Package },
      { label: 'Categories', to: '/categories', icon: Tag },
      { label: 'Brands', to: '/brands', icon: Layers },
      { label: 'Inventory', to: '/inventory', icon: Boxes },
    ],
  },
  {
    title: 'Sales',
    items: [
      { label: 'Orders', to: '/orders', icon: ShoppingBag },
      { label: 'Payments', to: '/payments', icon: CreditCard },
      { label: 'Reviews', to: '/reviews', icon: Star },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Customers', to: '/customers', icon: Users },
      { label: 'Users', to: '/users', icon: UserCheck },
      { label: 'Profile', to: '/profile', icon: User },
      { label: 'Settings', to: '/settings', icon: Settings },
    ],
  },
]

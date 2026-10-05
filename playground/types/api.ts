export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface AuthUser {
  id: number
  name: string | null
  email: string
  role: string
}

export interface AuthProfile extends AuthUser {
  isActive: boolean
}

export interface LoginResponse {
  message: string
  accessToken: string
  user: AuthUser
}

export interface User {
  id: number
  email: string
  name: string | null
  role: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Brand {
  id: number
  name: string
  description: string | null
  logo: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: number
  name: string
  description: string | null
  image: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Product {
  id: number

  name: string
  slug?: string | null
  description: string | null

  price: string
  originalPrice?: string | null

  sku: string | null

  image: string | null
  images?: string[]

  brandId: number | null
  brand: Brand | null

  categoryId: number | null
  category: Category | null

  stock?: number

  ratingAverage: string
  ratingCount: number

  rating?: string | null
  reviewCount?: number

  features?: string[]
  specifications?: Record<string, unknown>

  isFeatured?: boolean
  isBestseller?: boolean
  isFlashSale?: boolean

  isActive: boolean

  createdAt: string
  updatedAt: string
}

export interface Inventory {
  id: number
  productId: number
  product: Product
  quantity: number
  reserved: number
  lowStockThreshold: number
  createdAt: string
  updatedAt: string
}

export interface Customer {
  id: number
  userId: number
  user: User
  phone: string | null
  address: string | null
  city: string | null
  country: string | null
  gender: string | null
  dateOfBirth: string | null
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  id: number
  orderId: number
  productId: number
  product: Product
  quantity: number
  price: string
  createdAt: string
}

export interface Order {
  id: number
  userId: number
  user: User
  total: string
  status: string
  shippingAddress: string | null
  items: OrderItem[]
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: number
  orderId: number
  order: Order
  amount: string
  method: string
  status: string
  transactionId: string | null
  paidAt: string | null
  createdAt: string
}

export interface Review {
  id: number
  productId: number
  product: Product
  userId: number
  user: User
  rating: number
  comment: string | null
  createdAt: string
  updatedAt: string
}

export interface Cart {
  id: number
  userId: number
  createdAt: string
  updatedAt: string
}

export interface CartItem {
  id: number
  cartId: number
  productId: number
  product: Product
  quantity: number
  price: string
}

export interface CartWithItems extends Cart {
  items: CartItem[]
}

export interface RevenueByMonth {
  month: string
  total: string
  orders: number
}

export interface OrderStatusCount {
  status: string
  count: number
}

export interface TopProduct {
  productId: number
  name: string
  unitsSold: number
  revenue: string
}

export interface AnalyticsPeriodTotals {
  revenue: string
  orders: number
}

export interface CategoryRevenue {
  categoryId: number | null
  name: string
  revenue: string
  units: number
}

export interface LowStockItem {
  productId: number
  name: string
  quantity: number
  reserved: number
  threshold: number
}

export interface PaymentMethodTotal {
  method: string
  count: number
  amount: string
}

export interface CountByMonth {
  month: string
  count: number
}

export interface UnitsByMonth {
  month: string
  units: number
}

export interface AnalyticsPeriod {
  revenue: string
  orders: number
  units: number
  newCustomers: number
}

export interface Analytics {
  months: number
  revenueByMonth: RevenueByMonth[]
  orderStatusBreakdown: OrderStatusCount[]
  revenueByCategory: CategoryRevenue[]
  topProducts: TopProduct[]
  lowStockItems: LowStockItem[]
  customersByMonth: CountByMonth[]
  unitsByMonth: UnitsByMonth[]

  currentPeriod: AnalyticsPeriod
  previousPeriod: AnalyticsPeriodTotals

  /** Whole percentages, or null where there is no comparable prior period. */
  changes: {
    revenue: number | null
    orders: number | null
    averageOrderValue: number | null
  }

  averageOrderValue: string
  paymentMethodBreakdown: PaymentMethodTotal[]

  catalogueHealth: {
    totalProducts: number
    activeProducts: number
    inactiveProducts: number
  }
}

export const ANALYTICS_RANGES = [3, 6, 12] as const

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number]

export interface AdminStats {
  totalOrders: number
  pendingOrders: number
  cancelledOrders: number
  /** Orders that reached SHIPPED or DELIVERED. */
  fulfilledOrders: number
  totalRevenue: string
  totalProducts: number
  activeProducts: number
  inactiveProducts: number
  totalCustomers: number
  totalUsers: number
  totalBrands: number
  totalCategories: number
  totalInventoryUnits: number
  lowStockCount: number
  totalReviews: number
  /** Mean star rating out of 5, or null when nothing has been reviewed. */
  averageRating: number | null
  totalPayments: number
  paidPayments: number
  failedPayments: number
  revenueByMonth: RevenueByMonth[]
  orderStatusBreakdown: OrderStatusCount[]
  recentOrders: Order[]
  topProducts: TopProduct[]
}

export const ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const

export const PAYMENT_STATUSES = [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export interface TelegramStatus {
  connected: boolean
  username?: string | null
  firstName?: string | null
  linkedAt?: string | null
}

export interface TelegramConnectLink {
  username: string
  url: string
  expiresAt: string
}

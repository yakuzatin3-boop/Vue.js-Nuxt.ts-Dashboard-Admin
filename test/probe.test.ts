import { describe, it } from 'vitest'
import { answerQuestion, routeQuestion } from '../playground/utils/chatbot'

const analytics = {
  months: 6,
  revenueByMonth: [
    { month: '2026-05', total: '1000', orders: 10 },
    { month: '2026-06', total: '2000', orders: 20 },
    { month: '2026-08', total: '3000', orders: 30 },
  ],
  orderStatusBreakdown: [{ status: 'DELIVERED', count: 5 }, { status: 'PENDING', count: 2 }],
  revenueByCategory: [{ categoryId: 1, name: 'Cat', revenue: '500', units: 5 }],
  topProducts: [
    { productId: 1, name: 'Aura Lamp', unitsSold: 4, revenue: '400' },
    { productId: 2, name: 'Desk Mat', unitsSold: 2, revenue: '200' },
  ],
  lowStockItems: [{ productId: 1, name: 'Aura Lamp', quantity: 2, reserved: 1, threshold: 5 }],
  customersByMonth: [{ month: '2026-05', count: 3 }, { month: '2026-06', count: 4 }, { month: '2026-08', count: 5 }],
  unitsByMonth: [{ month: '2026-05', units: 12 }, { month: '2026-06', units: 24 }, { month: '2026-08', units: 33 }],
  currentPeriod: { revenue: '6000', orders: 60, units: 69, newCustomers: 12 },
  previousPeriod: { revenue: '3000', orders: 30 },
  changes: { revenue: 100, orders: 100, averageOrderValue: -10 },
  averageOrderValue: '100',
  paymentMethodBreakdown: [{ method: 'CARD', count: 8, amount: '800' }],
  catalogueHealth: { totalProducts: 3, activeProducts: 3, inactiveProducts: 0 },
}

const stats = {
  totalOrders: 60, pendingOrders: 2, cancelledOrders: 1, fulfilledOrders: 50,
  totalRevenue: '9000', totalProducts: 3, activeProducts: 3, inactiveProducts: 0,
  totalCustomers: 30, totalUsers: 40, totalBrands: 2, totalCategories: 1,
  totalInventoryUnits: 200, lowStockCount: 1, totalReviews: 8, averageRating: 4.2,
  totalPayments: 10, paidPayments: 9, failedPayments: 1,
  revenueByMonth: [], orderStatusBreakdown: [], recentOrders: [], topProducts: [],
}

const products = [
  { id: 1, name: 'Aura Lamp', price: '99', categoryId: 1, brandId: 1, isActive: true, ratingAverage: '4.4', ratingCount: 12, sku: 'A-1', description: null, originalPrice: null, image: null, createdAt: '', updatedAt: '' },
  { id: 2, name: 'Desk Mat', price: '29', categoryId: 1, brandId: 1, isActive: true, ratingAverage: '3.1', ratingCount: 4, sku: 'D-1', description: null, originalPrice: null, image: null, createdAt: '', updatedAt: '' },
]

const inventory = [
  { id: 1, productId: 1, quantity: 2, reserved: 1, lowStockThreshold: 5, createdAt: '', updatedAt: '' },
  { id: 2, productId: 2, quantity: 40, reserved: 0, lowStockThreshold: 5, createdAt: '', updatedAt: '' },
]

const categories = [{ id: 1, name: 'Lighting', description: null, image: null, isActive: true, createdAt: '', updatedAt: '' }]

const reviews = [
  { id: 1, productId: 1, product: products[0], userId: 1, user: { id: 1, email: 'a@b.c', name: 'A', role: 'CUSTOMER', isActive: true, createdAt: '', updatedAt: '' }, rating: 5, comment: 'great', createdAt: '', updatedAt: '' },
  { id: 2, productId: 2, product: products[1], userId: 1, user: { id: 1, email: 'a@b.c', name: 'A', role: 'CUSTOMER', isActive: true, createdAt: '', updatedAt: '' }, rating: 2, comment: 'meh', createdAt: '', updatedAt: '' },
]

const data = { stats, analytics, products, categories, inventory, reviews } as never

describe('probe', () => {
  const qs = [
    'hello', 'how is the store doing', 'show me the revenue trend', 'how did last month go',
    'how did june go', 'why did revenue drop', 'what do the orders look like', 'average order value',
    'top 3 products', 'which category earns the most', 'what is running out of stock',
    'which payment method wins', 'how many new customers', 'what do customers rate us',
    'forecast next month', 'what is the air quality in paris', 'how many aura lamps are left',
    'what is the price of the aura lamp', 'tell me about desk mat', 'last 3 months of revenue',
  ]
  for (const q of qs) {
    it(q, () => {
      const routed = routeQuestion(q, products as never)
      const reply = answerQuestion(q, data)
      console.log('=====', q, '| route:', routed.intent, JSON.stringify(routed.datasets), '| actual:', reply.intent)
      console.log('   ', reply.headline)
      for (const b of reply.blocks) if (b.kind === 'note') console.log('    note:', b.text)
    })
  }
})

import { signJWT, verifyPassword } from './auth'
import { AuthError, requireRole, requireUser, type GraphQLContext } from './context'

function newId(): string {
  return crypto.randomUUID()
}

function parseJson(value: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

async function requireOwnedRestaurant(ctx: GraphQLContext, restaurantId: string) {
  const user = requireUser(ctx)
  const restaurant = await ctx.env.DB.prepare(
    'SELECT owner_id FROM restaurants WHERE id = ?'
  )
    .bind(restaurantId)
    .first<{ owner_id: string }>()
  if (!restaurant) throw new Error('Restaurant not found')
  if (user.role !== 'admin' && restaurant.owner_id !== user.sub) {
    throw new AuthError('Forbidden')
  }
  return restaurant
}

interface OrderRow {
  id: string
  order_number: string
  customer_id: string
  restaurant_id: string
  rider_id: string | null
  zone_id: string | null
  delivery_address: string
  delivery_details: string | null
  delivery_label: string | null
  delivery_lat: number | null
  delivery_lng: number | null
  order_status: string
  payment_method: string
  payment_status: string
  is_active: number
  is_picked_up: number
  subtotal: number
  delivery_charges: number
  discount_amount: number
  taxation_amount: number
  tipping: number
  order_amount: number
  paid_amount: number
  instructions: string | null
  reason: string | null
  is_rider_ringed: number
  preparation_time: number | null
  selected_prep_time: number | null
  order_date: string | null
  expected_time: string | null
  completion_time: string | null
  accepted_at: string | null
  assigned_at: string | null
  picked_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
  restaurant_name?: string
  restaurant_image?: string | null
  restaurant_slug?: string | null
  restaurant_shop_type?: string | null
  restaurant_address?: string | null
  restaurant_lat?: number | null
  restaurant_lng?: number | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_email?: string | null
  rider_name?: string | null
  rider_username?: string | null
  rider_available?: number | null
  review_id?: string | null
  review_restaurant_rating?: number | null
  review_comment?: string | null
}

interface OrderItemRow {
  id: string
  order_id: string
  food_id: string | null
  title: string
  description: string | null
  image: string | null
  quantity: number
  unit_price: number
  special_instructions: string | null
  variation_json: string | null
  addons_json: string | null
  is_active: number
  created_at: string
  updated_at: string
}

const ORDER_SELECT = `
  SELECT o.*,
    r.name AS restaurant_name, r.image AS restaurant_image, r.slug AS restaurant_slug,
    r.shop_type AS restaurant_shop_type, r.address AS restaurant_address,
    r.lat AS restaurant_lat, r.lng AS restaurant_lng,
    cu.name AS customer_name, cu.phone AS customer_phone, cu.email AS customer_email,
    ri.name AS rider_name, ri.email AS rider_username,
    rp.is_available AS rider_available,
    rev.id AS review_id, rev.restaurant_rating AS review_restaurant_rating, rev.comment AS review_comment
  FROM orders o
  JOIN restaurants r ON r.id = o.restaurant_id
  JOIN users cu ON cu.id = o.customer_id
  LEFT JOIN users ri ON ri.id = o.rider_id
  LEFT JOIN rider_profiles rp ON rp.user_id = o.rider_id
  LEFT JOIN reviews rev ON rev.order_id = o.id
`

async function loadOrderItems(orderId: string, ctx: GraphQLContext) {
  const { results } = await ctx.env.DB.prepare(
    'SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid ASC'
  )
    .bind(orderId)
    .all<OrderItemRow>()
  return results.map((item) => ({
    _id: item.id,
    id: item.id,
    title: item.title,
    food: item.food_id,
    description: item.description,
    image: item.image,
    quantity: item.quantity,
    specialInstructions: item.special_instructions,
    variation: parseJson(item.variation_json),
    addons: parseJson(item.addons_json) ?? [],
    isActive: !!item.is_active,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  }))
}

async function mapOrder(row: OrderRow, ctx: GraphQLContext) {
  const items = await loadOrderItems(row.id, ctx)
  return {
    _id: row.id,
    id: row.id,
    orderId: row.order_number,
    restaurant: {
      _id: row.restaurant_id,
      id: row.restaurant_id,
      name: row.restaurant_name ?? '',
      image: row.restaurant_image ?? null,
      slug: row.restaurant_slug ?? null,
      shopType: row.restaurant_shop_type ?? null,
      address: row.restaurant_address ?? null,
      location: { coordinates: [row.restaurant_lng ?? 0, row.restaurant_lat ?? 0] }
    },
    zone: row.zone_id ? { _id: row.zone_id, id: row.zone_id } : null,
    deliveryAddress: {
      location: { coordinates: [row.delivery_lng ?? 0, row.delivery_lat ?? 0] },
      deliveryAddress: row.delivery_address,
      details: row.delivery_details,
      label: row.delivery_label,
      id: row.id
    },
    items,
    user: {
      _id: row.customer_id,
      id: row.customer_id,
      name: row.customer_name ?? null,
      phone: row.customer_phone ?? null,
      email: row.customer_email ?? null
    },
    rider: row.rider_id
      ? {
          _id: row.rider_id,
          id: row.rider_id,
          name: row.rider_name ?? null,
          username: row.rider_username ?? null,
          available: !!row.rider_available
        }
      : null,
    review: row.review_id
      ? {
          _id: row.review_id,
          rating: row.review_restaurant_rating,
          description: row.review_comment
        }
      : null,
    paymentMethod: row.payment_method,
    paidAmount: row.paid_amount,
    orderAmount: row.order_amount,
    discountAmount: row.discount_amount,
    orderStatus: row.order_status,
    status: row.order_status,
    paymentStatus: row.payment_status,
    isActive: !!row.is_active,
    isPickedUp: !!row.is_picked_up,
    deliveryCharges: row.delivery_charges,
    tipping: row.tipping,
    taxationAmount: row.taxation_amount,
    reason: row.reason,
    isRiderRinged: !!row.is_rider_ringed,
    preparationTime: row.preparation_time,
    selectedPrepTime: row.selected_prep_time,
    orderDate: row.order_date,
    expectedTime: row.expected_time,
    completionTime: row.completion_time,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    assignedAt: row.assigned_at,
    pickedAt: row.picked_at,
    deliveredAt: row.delivered_at,
    cancelledAt: row.cancelled_at,
    instructions: row.instructions,
    eta: null
  }
}

async function findOrderRow(ctx: GraphQLContext, id: string) {
  return ctx.env.DB.prepare(`${ORDER_SELECT} WHERE o.id = ?`).bind(id).first<OrderRow>()
}

async function recordStatus(ctx: GraphQLContext, orderId: string, status: string) {
  await ctx.env.DB.prepare(
    'INSERT INTO order_status_history (id, order_id, status) VALUES (?, ?, ?)'
  )
    .bind(newId(), orderId, status)
    .run()
}

// A rider row (users + rider_profiles), shaped for the admin/rider apps'
// richer "Rider" type — separate from the lean customer-facing shape
// returned by availableRiders in schema.ts.
interface WorkScheduleDayRow {
  day: string
  enabled: boolean
  slots: { startTime: string; endTime: string }[]
}

function parseWorkSchedule(raw: string | null): WorkScheduleDayRow[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function loadRiderProfile(ctx: GraphQLContext, id: string) {
  const row = await ctx.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.phone, u.image_url, u.is_active, u.created_at, u.updated_at,
            rp.vehicle_type, rp.zone_id, rp.is_available, rp.rating_avg, rp.rating_count,
            rp.current_wallet_amount, rp.total_wallet_amount, rp.withdrawn_wallet_amount,
            rp.vehicle_number, rp.vehicle_image, rp.license_number, rp.license_expiry_date,
            rp.license_image, rp.bank_name, rp.bank_account_name, rp.bank_account_code,
            rp.bank_account_number, rp.time_zone, rp.work_schedule
     FROM users u
     JOIN rider_profiles rp ON rp.user_id = u.id
     WHERE u.id = ? AND u.role = 'rider'`
  )
    .bind(id)
    .first<{
      id: string
      name: string
      email: string | null
      phone: string | null
      image_url: string | null
      is_active: number
      created_at: string
      updated_at: string
      vehicle_type: string | null
      zone_id: string | null
      is_available: number
      rating_avg: number
      rating_count: number
      current_wallet_amount: number
      total_wallet_amount: number
      withdrawn_wallet_amount: number
      vehicle_number: string | null
      vehicle_image: string | null
      license_number: string | null
      license_expiry_date: string | null
      license_image: string | null
      bank_name: string | null
      bank_account_name: string | null
      bank_account_code: string | null
      bank_account_number: string | null
      time_zone: string | null
      work_schedule: string | null
    }>()
  if (!row) return null
  const location = await ctx.env.DB.prepare(
    'SELECT lat, lng FROM rider_locations WHERE rider_id = ?'
  )
    .bind(id)
    .first<{ lat: number; lng: number }>()
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    username: row.email ?? row.id,
    email: row.email,
    phone: row.phone,
    imageUrl: row.image_url,
    image: row.image_url,
    vehicleType: row.vehicle_type,
    zone: row.zone_id ? { _id: row.zone_id, id: row.zone_id } : null,
    available: !!row.is_available,
    assigned: false,
    isActive: !!row.is_active,
    ratingAvg: row.rating_avg,
    ratingCount: row.rating_count,
    location: location ? { coordinates: [location.lng, location.lat] } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    accountNumber: null,
    currentWalletAmount: row.current_wallet_amount,
    totalWalletAmount: row.total_wallet_amount,
    withdrawnWalletAmount: row.withdrawn_wallet_amount,
    licenseDetails:
      row.license_number || row.license_expiry_date || row.license_image
        ? {
            number: row.license_number,
            expiryDate: row.license_expiry_date,
            image: row.license_image
          }
        : null,
    vehicleDetails:
      row.vehicle_number || row.vehicle_image
        ? { number: row.vehicle_number, image: row.vehicle_image }
        : null,
    bussinessDetails:
      row.bank_name || row.bank_account_name || row.bank_account_code || row.bank_account_number
        ? {
            bankName: row.bank_name,
            accountName: row.bank_account_name,
            accountCode: row.bank_account_code,
            accountNumber: row.bank_account_number
          }
        : null,
    timeZone: row.time_zone,
    workSchedule: parseWorkSchedule(row.work_schedule)
  }
}

export const orderTypeDefs = /* GraphQL */ `
  extend type Query {
    orders(page: Int, limit: Int): [Order!]!
    getUsersPastOrders(page: Int!, limit: Int!, offset: Int!): [Order!]!
    getUsersActiveOrders(page: Int!, limit: Int!, offset: Int!): [Order!]!
    orderDetails(id: String!): Order
    orderTracking(id: ID!): OrderTracking
    getActiveOrders(restaurantId: ID, page: Int, rowsPerPage: Int, actions: [String!], search: String): ActiveOrdersResult!
    ordersByRestId(restaurant: String!, page: Int, rows: Int, search: String, orderStatus: [String!]): OrdersByRestResult!
    ordersByRestIdWithoutPagination(restaurant: String!, search: String): [Order!]!
    riderOrders(limit: Int, offset: Int): [Order!]!
    rider(id: String!): Rider
    transactionHistory(limit: Int, offset: Int): RiderTransactionHistoryResult!
  }

  extend type Mutation {
    placeOrder(
      restaurant: String!
      orderInput: [OrderInput!]!
      paymentMethod: String!
      couponCode: String
      tipping: Float!
      taxationAmount: Float!
      address: AddressInput!
      orderDate: String!
      isPickedUp: Boolean!
      deliveryCharges: Float!
      instructions: String
    ): Order!
    reviewOrder(reviewInput: ReviewInput!): Order!
    abortOrder(id: String!): Order!
    updateStatus(id: String!, orderStatus: String!): Order!
    assignRider(id: String!, riderId: String!): Order!
    assignOrder(id: String!): Order!
    updateOrderStatusRider(id: String!, status: String!): Order!
    riderLogin(username: String, password: String, notificationToken: String, timeZone: String): OwnerLoginPayload!
    toggleAvailablity(id: String!): Rider!
    updateRiderLocation(
      latitude: String!
      longitude: String!
      accuracy: Float
      heading: Float
      speed: Float
      deviceTimestamp: String
    ): Rider!
    updateRiderVehicleDetails(id: String!, vehicleType: String, vehicleDetails: VehicleDetailsInput): Rider!
    updateRiderLicenseDetails(id: String!, licenseDetails: LicenseDetailsInput): Rider!
    updateRiderBussinessDetails(id: String!, bussinessDetails: BussinessDetailsInput): Rider!
    updateWorkSchedule(riderId: String!, workSchedule: [DayScheduleInput!]!, timeZone: String): Rider!
    editRider(riderInput: RiderInput!): Rider!
  }

  input RiderInput {
    _id: String!
    name: String
    username: String
    phone: String
    vehicleType: String
    available: Boolean
    # Accepted for compatibility with the existing rider app's edit form —
    # zones aren't modeled yet, so this is a no-op until they are.
    zone: String
  }

  input VehicleDetailsInput { number: String image: String }
  input LicenseDetailsInput { number: String expiryDate: String image: String }
  input BussinessDetailsInput { bankName: String accountName: String accountCode: String accountNumber: String }
  input WorkScheduleSlotInput { startTime: String! endTime: String! }
  input DayScheduleInput { day: String! enabled: Boolean! slots: [WorkScheduleSlotInput!] }

  extend type Rider {
    _id: ID!
    username: String
    email: String
    phone: String
    image: String
    available: Boolean
    assigned: Boolean
    isActive: Boolean
    zone: ZoneSummary
    location: Location
    createdAt: String
    updatedAt: String
    accountNumber: String
    currentWalletAmount: Float
    totalWalletAmount: Float
    withdrawnWalletAmount: Float
    licenseDetails: LicenseDetails
    vehicleDetails: VehicleDetails
    bussinessDetails: RiderBussinessDetails
    timeZone: String
    workSchedule: [WorkScheduleDay!]
  }

  type ZoneSummary {
    _id: ID!
    id: ID!
    title: String
  }

  type LicenseDetails { number: String expiryDate: String image: String }
  type VehicleDetails { number: String image: String }
  type RiderBussinessDetails { bankName: String accountName: String accountCode: String accountNumber: String }
  type WorkScheduleSlot { startTime: String endTime: String }
  type WorkScheduleDay { day: String enabled: Boolean slots: [WorkScheduleSlot!]! }

  type RiderWalletTransaction {
    id: ID!
    amount: Float!
    type: String!
    orderId: String
    createdAt: String!
    # Aliases matching the existing rider app's own transactionHistory query,
    # alongside the fields above (used by the web app's own wallet screen).
    status: String!
    amountTransferred: Float!
  }

  type RiderTransactionHistoryResult {
    data: [RiderWalletTransaction!]!
  }

  type OrderVariation { _id: ID! id: ID! title: String price: Float discounted: Float }
  type OrderAddonOption { _id: ID! id: ID! title: String description: String price: Float }
  type OrderAddon {
    _id: ID!
    id: ID!
    title: String
    description: String
    quantityMinimum: Int
    quantityMaximum: Int
    options: [OrderAddonOption!]!
  }
  type OrderFoodItem {
    _id: ID!
    id: ID!
    title: String!
    food: ID
    description: String
    image: String
    quantity: Int!
    specialInstructions: String
    variation: OrderVariation
    addons: [OrderAddon!]!
    isActive: Boolean!
    createdAt: String
    updatedAt: String
  }
  type OrderUserSummary { _id: ID! id: ID! name: String phone: String email: String }
  type OrderRiderSummary { _id: ID! id: ID! name: String username: String available: Boolean }
  type OrderRestaurantSummary2 {
    _id: ID!
    id: ID!
    name: String!
    image: String
    slug: String
    shopType: String
    address: String
    location: Location
  }
  type DeliveryAddressType {
    location: Location
    deliveryAddress: String
    details: String
    label: String
    id: ID
  }
  type OrderReviewSummary { _id: ID! rating: Int description: String }
  type OrderEtaPoint { latitude: Float longitude: Float }
  type OrderEta {
    phase: String
    source: String
    readyAt: String
    baseArrivalAt: String
    estimatedArrivalAt: String
    windowStartAt: String
    windowEndAt: String
    durationSeconds: Float
    distanceMeters: Float
    encodedPolyline: String
    origin: OrderEtaPoint
    destination: OrderEtaPoint
    calculatedAt: String
    lastLocationAt: String
    version: Int
  }

  type Order {
    _id: ID!
    id: ID!
    orderId: String!
    restaurant: OrderRestaurantSummary2!
    zone: ZoneSummary
    deliveryAddress: DeliveryAddressType
    items: [OrderFoodItem!]!
    user: OrderUserSummary
    rider: OrderRiderSummary
    review: OrderReviewSummary
    paymentMethod: String!
    paidAmount: Float!
    orderAmount: Float!
    discountAmount: Float
    orderStatus: String!
    status: String!
    paymentStatus: String!
    isActive: Boolean!
    isPickedUp: Boolean!
    deliveryCharges: Float!
    tipping: Float!
    taxationAmount: Float!
    reason: String
    isRiderRinged: Boolean
    preparationTime: Int
    selectedPrepTime: Int
    orderDate: String
    expectedTime: String
    completionTime: String
    createdAt: String!
    acceptedAt: String
    assignedAt: String
    pickedAt: String
    deliveredAt: String
    cancelledAt: String
    instructions: String
    eta: OrderEta
  }

  type ActiveOrdersResult { totalCount: Int! orders: [Order!]! }
  type OrdersByRestResult {
    totalCount: Int!
    totalPages: Int!
    currentPage: Int!
    prevPage: Int
    nextPage: Int
    orders: [Order!]!
  }

  type RiderLocationPoint {
    latitude: Float!
    longitude: Float!
    accuracy: Float
    heading: Float
    speed: Float
    recordedAt: String
  }
  type OrderTracking {
    orderId: ID!
    status: String!
    riderLocation: RiderLocationPoint
    eta: OrderEta
  }

  input OrderAddonInput { _id: String! options: [String!] }
  input OrderInput {
    food: String!
    quantity: Int!
    variation: String
    specialInstructions: String
    addons: [OrderAddonInput!]
  }
  input AddressInput {
    label: String
    deliveryAddress: String
    details: String
    longitude: String
    latitude: String
  }
  input ReviewInput {
    order: String!
    rating: Int!
    description: String
    comments: String
  }
`

export const orderResolvers = {
  Query: {
    orders: async (_p: unknown, args: { page?: number; limit?: number }, ctx: GraphQLContext) => {
      const user = requireUser(ctx)
      const limit = args.limit ?? 20
      const offset = ((args.page ?? 1) - 1) * limit
      const { results } = await ctx.env.DB.prepare(
        `${ORDER_SELECT} WHERE o.customer_id = ? ORDER BY o.created_at DESC LIMIT ? OFFSET ?`
      )
        .bind(user.sub, limit, offset)
        .all<OrderRow>()
      return Promise.all(results.map((r) => mapOrder(r, ctx)))
    },

    getUsersActiveOrders: async (
      _p: unknown,
      args: { page: number; limit: number; offset: number },
      ctx: GraphQLContext
    ) => {
      const user = requireUser(ctx)
      const { results } = await ctx.env.DB.prepare(
        `${ORDER_SELECT} WHERE o.customer_id = ?
           AND o.order_status IN ('PENDING','ACCEPTED','ASSIGNED','PICKED')
         ORDER BY o.created_at DESC LIMIT ? OFFSET ?`
      )
        .bind(user.sub, args.limit, args.offset)
        .all<OrderRow>()
      return Promise.all(results.map((r) => mapOrder(r, ctx)))
    },

    getUsersPastOrders: async (
      _p: unknown,
      args: { page: number; limit: number; offset: number },
      ctx: GraphQLContext
    ) => {
      const user = requireUser(ctx)
      const { results } = await ctx.env.DB.prepare(
        `${ORDER_SELECT} WHERE o.customer_id = ?
           AND o.order_status IN ('DELIVERED','COMPLETED','CANCELLED')
         ORDER BY o.created_at DESC LIMIT ? OFFSET ?`
      )
        .bind(user.sub, args.limit, args.offset)
        .all<OrderRow>()
      return Promise.all(results.map((r) => mapOrder(r, ctx)))
    },

    orderDetails: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx)
      const row = await findOrderRow(ctx, args.id)
      if (!row) return null
      if (user.role !== 'admin') {
        const restaurant = await ctx.env.DB.prepare(
          'SELECT owner_id FROM restaurants WHERE id = ?'
        )
          .bind(row.restaurant_id)
          .first<{ owner_id: string }>()
        const isOwner = row.customer_id === user.sub
        const isRider = row.rider_id === user.sub
        const isVendor = restaurant?.owner_id === user.sub
        if (!isOwner && !isRider && !isVendor) throw new AuthError('Forbidden')
      }
      return mapOrder(row, ctx)
    },

    orderTracking: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireUser(ctx)
      const row = await findOrderRow(ctx, args.id)
      if (!row) return null
      let riderLocation = null
      if (row.rider_id) {
        const loc = await ctx.env.DB.prepare(
          'SELECT lat, lng, updated_at FROM rider_locations WHERE rider_id = ?'
        )
          .bind(row.rider_id)
          .first<{ lat: number; lng: number; updated_at: string }>()
        if (loc) {
          riderLocation = {
            latitude: loc.lat,
            longitude: loc.lng,
            accuracy: null,
            heading: null,
            speed: null,
            recordedAt: loc.updated_at
          }
        }
      }
      return { orderId: row.id, status: row.order_status, riderLocation, eta: null }
    },

    getActiveOrders: async (
      _p: unknown,
      args: {
        restaurantId?: string
        page?: number
        rowsPerPage?: number
        actions?: string[]
        search?: string
      },
      ctx: GraphQLContext
    ) => {
      const user = requireUser(ctx)
      const limit = args.rowsPerPage ?? 20
      const offset = ((args.page ?? 1) - 1) * limit
      const conditions: string[] = [`o.order_status NOT IN ('DELIVERED','COMPLETED','CANCELLED')`]
      const params: unknown[] = []
      if (args.restaurantId) {
        await requireOwnedRestaurant(ctx, args.restaurantId)
        conditions.push('o.restaurant_id = ?')
        params.push(args.restaurantId)
      } else if (user.role !== 'admin') {
        conditions.push('r.owner_id = ?')
        params.push(user.sub)
      }
      if (args.search) {
        conditions.push('o.order_number LIKE ?')
        params.push(`%${args.search}%`)
      }
      const where = `WHERE ${conditions.join(' AND ')}`
      const countRow = await ctx.env.DB.prepare(
        `SELECT COUNT(*) AS c FROM orders o JOIN restaurants r ON r.id = o.restaurant_id ${where}`
      )
        .bind(...params)
        .first<{ c: number }>()
      const { results } = await ctx.env.DB.prepare(
        `${ORDER_SELECT} ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`
      )
        .bind(...params, limit, offset)
        .all<OrderRow>()
      return {
        totalCount: countRow?.c ?? 0,
        orders: await Promise.all(results.map((r) => mapOrder(r, ctx)))
      }
    },

    ordersByRestId: async (
      _p: unknown,
      args: { restaurant: string; page?: number; rows?: number; search?: string; orderStatus?: string[] },
      ctx: GraphQLContext
    ) => {
      await requireOwnedRestaurant(ctx, args.restaurant)
      const limit = args.rows ?? 20
      const page = args.page ?? 1
      const offset = (page - 1) * limit
      const conditions = ['o.restaurant_id = ?']
      const params: unknown[] = [args.restaurant]
      if (args.search) {
        conditions.push('o.order_number LIKE ?')
        params.push(`%${args.search}%`)
      }
      if (args.orderStatus && args.orderStatus.length > 0) {
        conditions.push(`o.order_status IN (${args.orderStatus.map(() => '?').join(',')})`)
        params.push(...args.orderStatus)
      }
      const where = `WHERE ${conditions.join(' AND ')}`
      const countRow = await ctx.env.DB.prepare(`SELECT COUNT(*) AS c FROM orders o ${where}`)
        .bind(...params)
        .first<{ c: number }>()
      const totalCount = countRow?.c ?? 0
      const totalPages = Math.max(1, Math.ceil(totalCount / limit))
      const { results } = await ctx.env.DB.prepare(
        `${ORDER_SELECT} ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`
      )
        .bind(...params, limit, offset)
        .all<OrderRow>()
      return {
        totalCount,
        totalPages,
        currentPage: page,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null,
        orders: await Promise.all(results.map((r) => mapOrder(r, ctx)))
      }
    },

    ordersByRestIdWithoutPagination: async (
      _p: unknown,
      args: { restaurant: string; search?: string },
      ctx: GraphQLContext
    ) => {
      await requireOwnedRestaurant(ctx, args.restaurant)
      const conditions = ['o.restaurant_id = ?']
      const params: unknown[] = [args.restaurant]
      if (args.search) {
        conditions.push('o.order_number LIKE ?')
        params.push(`%${args.search}%`)
      }
      const { results } = await ctx.env.DB.prepare(
        `${ORDER_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY o.created_at DESC`
      )
        .bind(...params)
        .all<OrderRow>()
      return Promise.all(results.map((r) => mapOrder(r, ctx)))
    },

    riderOrders: async (
      _p: unknown,
      args: { limit?: number; offset?: number },
      ctx: GraphQLContext
    ) => {
      const user = requireRole(ctx, 'rider')
      const limit = args.limit ?? 50
      const offset = args.offset ?? 0
      // Rider apps bucket a single list client-side into "new" (unassigned,
      // ready for pickup) vs "processing" (already claimed by me) — so this
      // returns both: orders already assigned to this rider, plus unclaimed
      // ones any rider can pick up.
      const { results } = await ctx.env.DB.prepare(
        `${ORDER_SELECT} WHERE (o.rider_id = ? OR (o.rider_id IS NULL AND o.order_status = 'ACCEPTED'))
           AND o.order_status NOT IN ('DELIVERED','COMPLETED','CANCELLED')
         ORDER BY o.created_at DESC LIMIT ? OFFSET ?`
      )
        .bind(user.sub, limit, offset)
        .all<OrderRow>()
      return Promise.all(results.map((r) => mapOrder(r, ctx)))
    },

    rider: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireUser(ctx)
      return loadRiderProfile(ctx, args.id)
    },

    transactionHistory: async (
      _p: unknown,
      args: { limit?: number; offset?: number },
      ctx: GraphQLContext
    ) => {
      const user = requireRole(ctx, 'rider')
      const { results } = await ctx.env.DB.prepare(
        `SELECT id, amount, type, order_id, created_at FROM rider_wallet_transactions
         WHERE rider_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
        .bind(user.sub, args.limit ?? 50, args.offset ?? 0)
        .all<{
          id: string
          amount: number
          type: string
          order_id: string | null
          created_at: string
        }>()
      return {
        data: results.map((r) => ({
          id: r.id,
          amount: r.amount,
          type: r.type,
          orderId: r.order_id,
          createdAt: r.created_at,
          status: 'completed',
          amountTransferred: r.amount
        }))
      }
    }
  },

  Mutation: {
    placeOrder: async (
      _p: unknown,
      args: {
        restaurant: string
        orderInput: Array<{
          food: string
          quantity: number
          variation?: string
          specialInstructions?: string
          addons?: Array<{ _id: string; options?: string[] }>
        }>
        paymentMethod: string
        couponCode?: string
        tipping: number
        taxationAmount: number
        address: { label?: string; deliveryAddress?: string; details?: string; longitude?: string; latitude?: string }
        orderDate: string
        isPickedUp: boolean
        deliveryCharges: number
        instructions?: string
      },
      ctx: GraphQLContext
    ) => {
      const user = requireUser(ctx)
      if (!args.orderInput.length) throw new Error('Cart is empty')

      const restaurant = await ctx.env.DB.prepare(
        'SELECT id, zone_id FROM restaurants WHERE id = ?'
      )
        .bind(args.restaurant)
        .first<{ id: string; zone_id: string | null }>()
      if (!restaurant) throw new Error('Restaurant not found')

      const orderId = newId()
      const itemRows: {
        id: string
        title: string
        description: string | null
        image: string | null
        quantity: number
        unitPrice: number
        specialInstructions: string | null
        variationJson: string | null
        addonsJson: string | null
        lineTotal: number
      }[] = []

      for (const line of args.orderInput) {
        const food = await ctx.env.DB.prepare(
          'SELECT id, title, description, image FROM foods WHERE id = ? AND restaurant_id = ?'
        )
          .bind(line.food, args.restaurant)
          .first<{ id: string; title: string; description: string | null; image: string | null }>()
        if (!food) throw new Error(`Food item not found: ${line.food}`)

        let unitPrice = 0
        let variationJson: string | null = null
        if (line.variation) {
          const variation = await ctx.env.DB.prepare(
            'SELECT id, title, price, discounted FROM food_variations WHERE id = ? AND food_id = ?'
          )
            .bind(line.variation, line.food)
            .first<{ id: string; title: string; price: number; discounted: number | null }>()
          if (!variation) throw new Error(`Variation not found: ${line.variation}`)
          unitPrice = variation.discounted && variation.discounted > 0 ? variation.discounted : variation.price
          variationJson = JSON.stringify({
            _id: variation.id,
            id: variation.id,
            title: variation.title,
            price: variation.price,
            discounted: variation.discounted
          })
        }

        const addonsOut: unknown[] = []
        for (const addonSel of line.addons ?? []) {
          const addon = await ctx.env.DB.prepare(
            'SELECT id, title, description, quantity_minimum, quantity_maximum FROM addons WHERE id = ?'
          )
            .bind(addonSel._id)
            .first<{
              id: string
              title: string
              description: string | null
              quantity_minimum: number
              quantity_maximum: number
            }>()
          if (!addon) continue
          const options: unknown[] = []
          for (const optionId of addonSel.options ?? []) {
            const option = await ctx.env.DB.prepare(
              'SELECT id, title, description, price FROM options WHERE id = ?'
            )
              .bind(optionId)
              .first<{ id: string; title: string; description: string | null; price: number }>()
            if (!option) continue
            unitPrice += option.price
            options.push({
              _id: option.id,
              id: option.id,
              title: option.title,
              description: option.description,
              price: option.price
            })
          }
          addonsOut.push({
            _id: addon.id,
            id: addon.id,
            title: addon.title,
            description: addon.description,
            quantityMinimum: addon.quantity_minimum,
            quantityMaximum: addon.quantity_maximum,
            options
          })
        }

        const lineTotal = unitPrice * line.quantity
        itemRows.push({
          id: newId(),
          title: food.title,
          description: food.description,
          image: food.image,
          quantity: line.quantity,
          unitPrice,
          specialInstructions: line.specialInstructions ?? null,
          variationJson,
          addonsJson: addonsOut.length > 0 ? JSON.stringify(addonsOut) : null,
          lineTotal
        })
      }

      const subtotal = itemRows.reduce((sum, item) => sum + item.lineTotal, 0)

      let discountAmount = 0
      if (args.couponCode) {
        const coupon = await ctx.env.DB.prepare(
          `SELECT discount_type, discount_value_cents, discount_percentage, max_discount_cents
           FROM coupons WHERE code = ? AND is_active = 1
             AND (restaurant_id IS NULL OR restaurant_id = ?)
             AND (expires_at IS NULL OR expires_at > datetime('now'))`
        )
          .bind(args.couponCode, args.restaurant)
          .first<{
            discount_type: string
            discount_value_cents: number | null
            discount_percentage: number | null
            max_discount_cents: number | null
          }>()
        if (coupon) {
          if (coupon.discount_type === 'PERCENTAGE' && coupon.discount_percentage) {
            discountAmount = subtotal * (coupon.discount_percentage / 100)
          } else if (coupon.discount_value_cents) {
            discountAmount = coupon.discount_value_cents / 100
          }
          if (coupon.max_discount_cents) {
            discountAmount = Math.min(discountAmount, coupon.max_discount_cents / 100)
          }
        }
      }

      const orderAmount =
        subtotal - discountAmount + args.taxationAmount + args.tipping + args.deliveryCharges
      const orderNumber = orderId.slice(0, 8).toUpperCase()

      await ctx.env.DB.prepare(
        `INSERT INTO orders (
          id, order_number, customer_id, restaurant_id, zone_id,
          delivery_address, delivery_details, delivery_label, delivery_lat, delivery_lng,
          order_status, payment_method, payment_status,
          is_picked_up, subtotal, delivery_charges, discount_amount, taxation_amount, tipping,
          order_amount, instructions, order_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          orderId,
          orderNumber,
          user.sub,
          args.restaurant,
          restaurant.zone_id,
          args.address.deliveryAddress ?? '',
          args.address.details ?? null,
          args.address.label ?? null,
          args.address.latitude ? Number(args.address.latitude) : null,
          args.address.longitude ? Number(args.address.longitude) : null,
          args.paymentMethod,
          args.isPickedUp ? 1 : 0,
          subtotal,
          args.deliveryCharges,
          discountAmount,
          args.taxationAmount,
          args.tipping,
          orderAmount,
          args.instructions ?? null,
          args.orderDate
        )
        .run()

      for (const item of itemRows) {
        await ctx.env.DB.prepare(
          `INSERT INTO order_items (id, order_id, food_id, title, description, image, quantity, unit_price, special_instructions, variation_json, addons_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            item.id,
            orderId,
            null,
            item.title,
            item.description,
            item.image,
            item.quantity,
            item.unitPrice,
            item.specialInstructions,
            item.variationJson,
            item.addonsJson
          )
          .run()
      }
      await recordStatus(ctx, orderId, 'PENDING')

      const row = await findOrderRow(ctx, orderId)
      return mapOrder(row!, ctx)
    },

    reviewOrder: async (
      _p: unknown,
      args: { reviewInput: { order: string; rating: number; description?: string; comments?: string } },
      ctx: GraphQLContext
    ) => {
      const user = requireUser(ctx)
      const row = await findOrderRow(ctx, args.reviewInput.order)
      if (!row) throw new Error('Order not found')
      if (row.customer_id !== user.sub) throw new AuthError('Forbidden')
      await ctx.env.DB.prepare(
        `INSERT INTO reviews (id, order_id, customer_id, restaurant_id, rider_id, restaurant_rating, rider_rating, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          newId(),
          row.id,
          row.customer_id,
          row.restaurant_id,
          row.rider_id,
          args.reviewInput.rating,
          args.reviewInput.rating,
          args.reviewInput.description ?? args.reviewInput.comments ?? null
        )
        .run()
      const updated = await findOrderRow(ctx, row.id)
      return mapOrder(updated!, ctx)
    },

    abortOrder: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx)
      const row = await findOrderRow(ctx, args.id)
      if (!row) throw new Error('Order not found')
      const restaurant = await ctx.env.DB.prepare('SELECT owner_id FROM restaurants WHERE id = ?')
        .bind(row.restaurant_id)
        .first<{ owner_id: string }>()
      const allowed =
        user.role === 'admin' ||
        row.customer_id === user.sub ||
        row.rider_id === user.sub ||
        restaurant?.owner_id === user.sub
      if (!allowed) throw new AuthError('Forbidden')
      await ctx.env.DB.prepare(
        `UPDATE orders SET order_status = 'CANCELLED', cancelled_at = datetime('now'), reason = ?, updated_at = datetime('now') WHERE id = ?`
      )
        .bind('Cancelled', args.id)
        .run()
      await recordStatus(ctx, args.id, 'CANCELLED')
      const updated = await findOrderRow(ctx, args.id)
      return mapOrder(updated!, ctx)
    },

    updateStatus: async (
      _p: unknown,
      args: { id: string; orderStatus: string },
      ctx: GraphQLContext
    ) => {
      const row = await findOrderRow(ctx, args.id)
      if (!row) throw new Error('Order not found')
      await requireOwnedRestaurant(ctx, row.restaurant_id)
      const column =
        args.orderStatus === 'ACCEPTED'
          ? 'accepted_at'
          : args.orderStatus === 'DELIVERED'
            ? 'delivered_at'
            : args.orderStatus === 'COMPLETED'
              ? 'completion_time'
              : null
      await ctx.env.DB.prepare(
        `UPDATE orders SET order_status = ?${column ? `, ${column} = datetime('now')` : ''}, updated_at = datetime('now') WHERE id = ?`
      )
        .bind(args.orderStatus, args.id)
        .run()
      await recordStatus(ctx, args.id, args.orderStatus)
      const updated = await findOrderRow(ctx, args.id)
      return mapOrder(updated!, ctx)
    },

    assignRider: async (
      _p: unknown,
      args: { id: string; riderId: string },
      ctx: GraphQLContext
    ) => {
      const row = await findOrderRow(ctx, args.id)
      if (!row) throw new Error('Order not found')
      await requireOwnedRestaurant(ctx, row.restaurant_id)
      await ctx.env.DB.prepare(
        `UPDATE orders SET rider_id = ?, order_status = 'ASSIGNED', assigned_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
      )
        .bind(args.riderId, args.id)
        .run()
      await recordStatus(ctx, args.id, 'ASSIGNED')
      const updated = await findOrderRow(ctx, args.id)
      return mapOrder(updated!, ctx)
    },

    assignOrder: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const user = requireRole(ctx, 'rider')
      const row = await findOrderRow(ctx, args.id)
      if (!row) throw new Error('Order not found')
      if (row.rider_id) throw new Error('Order already assigned')
      await ctx.env.DB.prepare(
        `UPDATE orders SET rider_id = ?, order_status = 'ASSIGNED', assigned_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
      )
        .bind(user.sub, args.id)
        .run()
      await recordStatus(ctx, args.id, 'ASSIGNED')
      const updated = await findOrderRow(ctx, args.id)
      return mapOrder(updated!, ctx)
    },

    updateOrderStatusRider: async (
      _p: unknown,
      args: { id: string; status: string },
      ctx: GraphQLContext
    ) => {
      const user = requireRole(ctx, 'rider')
      const row = await findOrderRow(ctx, args.id)
      if (!row) throw new Error('Order not found')
      if (row.rider_id !== user.sub) throw new AuthError('Forbidden')
      const column =
        args.status === 'PICKED' ? 'picked_at' : args.status === 'DELIVERED' ? 'delivered_at' : null
      await ctx.env.DB.prepare(
        `UPDATE orders SET order_status = ?${column ? `, ${column} = datetime('now')` : ''}, updated_at = datetime('now') WHERE id = ?`
      )
        .bind(args.status, args.id)
        .run()
      await recordStatus(ctx, args.id, args.status)
      if (args.status === 'DELIVERED') {
        await ctx.env.DB.prepare(
          `UPDATE rider_profiles SET current_wallet_amount = current_wallet_amount + ?,
             total_wallet_amount = total_wallet_amount + ? WHERE user_id = ?`
        )
          .bind(row.delivery_charges, row.delivery_charges, user.sub)
          .run()
        await ctx.env.DB.prepare(
          `INSERT INTO rider_wallet_transactions (id, rider_id, order_id, amount, type)
           VALUES (?, ?, ?, ?, 'delivery_earning')`
        )
          .bind(newId(), user.sub, args.id, row.delivery_charges)
          .run()
      }
      const updated = await findOrderRow(ctx, args.id)
      return mapOrder(updated!, ctx)
    },

    riderLogin: async (
      _p: unknown,
      args: { username?: string; password?: string },
      ctx: GraphQLContext
    ) => {
      if (!args.username || !args.password) throw new Error('Username and password are required')
      const user = await ctx.env.DB.prepare(
        `SELECT id, email, name, role, image_url, password_hash FROM users
         WHERE role = 'rider' AND (email = ? OR phone = ?)`
      )
        .bind(args.username.toLowerCase(), args.username)
        .first<{
          id: string
          email: string | null
          name: string
          role: string
          image_url: string | null
          password_hash: string | null
        }>()
      if (!user?.password_hash || !(await verifyPassword(args.password, user.password_hash))) {
        throw new Error('Invalid username or password')
      }
      const token = await signJWT({ sub: user.id, role: 'rider' }, ctx.env.JWT_SECRET)
      const inThirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      return {
        userId: user.id,
        token,
        tokenExpiration: inThirtyDays,
        refreshToken: token,
        refreshTokenExpiration: inThirtyDays,
        email: user.email,
        userType: 'RIDER',
        restaurants: [],
        permissions: [],
        userTypeId: user.id,
        image: user.image_url,
        name: user.name
      }
    },

    toggleAvailablity: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const user = requireRole(ctx, 'rider', 'admin')
      const riderId = user.role === 'admin' ? args.id : user.sub
      await ctx.env.DB.prepare(
        'UPDATE rider_profiles SET is_available = 1 - is_available WHERE user_id = ?'
      )
        .bind(riderId)
        .run()
      return loadRiderProfile(ctx, riderId)
    },

    editRider: async (
      _p: unknown,
      args: {
        riderInput: {
          _id: string
          name?: string
          username?: string
          phone?: string
          vehicleType?: string
          available?: boolean
          zone?: string
        }
      },
      ctx: GraphQLContext
    ) => {
      const user = requireRole(ctx, 'rider', 'admin')
      const riderId = user.role === 'admin' ? args.riderInput._id : user.sub
      const { name, phone, vehicleType, available } = args.riderInput
      if (name !== undefined || phone !== undefined) {
        await ctx.env.DB.prepare(
          'UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?'
        )
          .bind(name ?? null, phone ?? null, riderId)
          .run()
      }
      if (vehicleType !== undefined || available !== undefined) {
        await ctx.env.DB.prepare(
          `UPDATE rider_profiles SET
             vehicle_type = COALESCE(?, vehicle_type),
             is_available = COALESCE(?, is_available)
           WHERE user_id = ?`
        )
          .bind(vehicleType ?? null, available === undefined ? null : available ? 1 : 0, riderId)
          .run()
      }
      return loadRiderProfile(ctx, riderId)
    },

    updateRiderLocation: async (
      _p: unknown,
      args: { latitude: string; longitude: string },
      ctx: GraphQLContext
    ) => {
      const user = requireRole(ctx, 'rider')
      await ctx.env.DB.prepare(
        `INSERT INTO rider_locations (rider_id, lat, lng) VALUES (?, ?, ?)
         ON CONFLICT(rider_id) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, updated_at = datetime('now')`
      )
        .bind(user.sub, Number(args.latitude), Number(args.longitude))
        .run()
      return loadRiderProfile(ctx, user.sub)
    },

    updateRiderVehicleDetails: async (
      _p: unknown,
      args: {
        id: string
        vehicleType?: string
        vehicleDetails?: { number?: string; image?: string }
      },
      ctx: GraphQLContext
    ) => {
      const user = requireRole(ctx, 'rider')
      if (args.id !== user.sub) throw new AuthError('Forbidden')
      await ctx.env.DB.prepare(
        `UPDATE rider_profiles SET
           vehicle_type = COALESCE(?, vehicle_type),
           vehicle_number = COALESCE(?, vehicle_number),
           vehicle_image = COALESCE(?, vehicle_image)
         WHERE user_id = ?`
      )
        .bind(
          args.vehicleType ?? null,
          args.vehicleDetails?.number ?? null,
          args.vehicleDetails?.image ?? null,
          user.sub
        )
        .run()
      return loadRiderProfile(ctx, user.sub)
    },

    updateRiderLicenseDetails: async (
      _p: unknown,
      args: { id: string; licenseDetails?: { number?: string; expiryDate?: string; image?: string } },
      ctx: GraphQLContext
    ) => {
      const user = requireRole(ctx, 'rider')
      if (args.id !== user.sub) throw new AuthError('Forbidden')
      await ctx.env.DB.prepare(
        `UPDATE rider_profiles SET
           license_number = COALESCE(?, license_number),
           license_expiry_date = COALESCE(?, license_expiry_date),
           license_image = COALESCE(?, license_image)
         WHERE user_id = ?`
      )
        .bind(
          args.licenseDetails?.number ?? null,
          args.licenseDetails?.expiryDate ?? null,
          args.licenseDetails?.image ?? null,
          user.sub
        )
        .run()
      return loadRiderProfile(ctx, user.sub)
    },

    updateRiderBussinessDetails: async (
      _p: unknown,
      args: {
        id: string
        bussinessDetails?: {
          bankName?: string
          accountName?: string
          accountCode?: string
          accountNumber?: string
        }
      },
      ctx: GraphQLContext
    ) => {
      const user = requireRole(ctx, 'rider')
      if (args.id !== user.sub) throw new AuthError('Forbidden')
      await ctx.env.DB.prepare(
        `UPDATE rider_profiles SET
           bank_name = COALESCE(?, bank_name),
           bank_account_name = COALESCE(?, bank_account_name),
           bank_account_code = COALESCE(?, bank_account_code),
           bank_account_number = COALESCE(?, bank_account_number)
         WHERE user_id = ?`
      )
        .bind(
          args.bussinessDetails?.bankName ?? null,
          args.bussinessDetails?.accountName ?? null,
          args.bussinessDetails?.accountCode ?? null,
          args.bussinessDetails?.accountNumber ?? null,
          user.sub
        )
        .run()
      return loadRiderProfile(ctx, user.sub)
    },

    updateWorkSchedule: async (
      _p: unknown,
      args: { riderId: string; workSchedule: WorkScheduleDayRow[]; timeZone?: string },
      ctx: GraphQLContext
    ) => {
      const user = requireRole(ctx, 'rider')
      if (args.riderId !== user.sub) throw new AuthError('Forbidden')
      await ctx.env.DB.prepare(
        `UPDATE rider_profiles SET work_schedule = ?, time_zone = COALESCE(?, time_zone) WHERE user_id = ?`
      )
        .bind(JSON.stringify(args.workSchedule), args.timeZone ?? null, user.sub)
        .run()
      return loadRiderProfile(ctx, user.sub)
    }
  }
}

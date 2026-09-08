import type { GraphQLContext } from './context'
import { AuthError, requireUser } from './context'
import { hashPassword } from './auth'

function newId(): string {
  return crypto.randomUUID()
}

// ---------------------------------------------------------------------------
// Shared row/shape helpers
// ---------------------------------------------------------------------------

interface RestaurantRow {
  id: string
  owner_id: string
  zone_id: string | null
  order_prefix: string | null
  name: string
  slug: string | null
  username: string | null
  phone: string | null
  address: string | null
  city: string | null
  post_code: string | null
  lat: number | null
  lng: number | null
  image: string | null
  logo: string | null
  cuisines: string | null
  shop_type: string | null
  is_active: number
  is_available: number
  delivery_time: number
  minimum_order: number
  commission_rate: number
  tax: number
  sales_tax: number
  rating: number
  review_average: number
  bound_type: string | null
  delivery_bounds: string | null
  circle_radius: number | null
  min_delivery_fee: number | null
  delivery_distance: number | null
  delivery_fee: number | null
  bank_name: string | null
  account_name: string | null
  account_code: string | null
  account_number: string | null
  business_reg_no: string | null
  company_reg_no: string | null
  business_tax_rate: number | null
  current_wallet_amount: number
  total_wallet_amount: number
  withdrawn_wallet_amount: number
  stripe_details_submitted: number
  opening_times: string | null
}

function parseJsonArray(value: string | null): unknown[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function mapOpeningTimes(value: string | null) {
  return parseJsonArray(value) as {
    day: string
    times: { startTime: string[]; endTime: string[] }[]
  }[]
}

function mapRestaurantListItem(r: RestaurantRow) {
  return {
    id: r.id,
    orderId: r.id,
    orderPrefix: r.order_prefix,
    name: r.name,
    image: r.image,
    logo: r.logo,
    username: r.username,
    slug: r.slug,
    address: r.address,
    deliveryTime: r.delivery_time,
    minimumOrder: r.minimum_order,
    isActive: !!r.is_active,
    commissionRate: r.commission_rate,
    tax: r.tax,
    phone: r.phone,
    shopType: r.shop_type,
    ownerId: r.owner_id,
    location: { coordinates: [r.lng ?? 0, r.lat ?? 0] },
    cuisines: parseJsonArray(r.cuisines)
  }
}

async function loadCategoriesTree(db: D1Database, restaurantId: string) {
  const { results: categories } = await db
    .prepare(
      'SELECT id, title, image, created_at, updated_at FROM categories WHERE restaurant_id = ? ORDER BY sort_order ASC'
    )
    .bind(restaurantId)
    .all<{
      id: string
      title: string
      image: string | null
      created_at: string
      updated_at: string
    }>()

  const { results: foods } = await db
    .prepare(
      `SELECT id, category_id, sub_category_id, title, description, image,
              is_active, is_out_of_stock, created_at, updated_at
       FROM foods WHERE restaurant_id = ?`
    )
    .bind(restaurantId)
    .all<{
      id: string
      category_id: string
      sub_category_id: string | null
      title: string
      description: string | null
      image: string | null
      is_active: number
      is_out_of_stock: number
      created_at: string
      updated_at: string
    }>()

  const foodIds = foods.map((f) => f.id)
  let variationsByFood = new Map<string, unknown[]>()
  if (foodIds.length > 0) {
    const placeholders = foodIds.map(() => '?').join(',')
    const { results: variations } = await db
      .prepare(
        `SELECT id, food_id, title, price, discounted, is_out_of_stock
         FROM food_variations WHERE food_id IN (${placeholders})
         ORDER BY sort_order ASC`
      )
      .bind(...foodIds)
      .all<{
        id: string
        food_id: string
        title: string
        price: number
        discounted: number | null
        is_out_of_stock: number
      }>()

    const variationIds = variations.map((v) => v.id)
    const addonsByVariation = new Map<string, string[]>()
    if (variationIds.length > 0) {
      const vPlaceholders = variationIds.map(() => '?').join(',')
      const { results: links } = await db
        .prepare(
          `SELECT food_variation_id, addon_id FROM food_variation_addons
           WHERE food_variation_id IN (${vPlaceholders})`
        )
        .bind(...variationIds)
        .all<{ food_variation_id: string; addon_id: string }>()
      for (const link of links) {
        const list = addonsByVariation.get(link.food_variation_id) ?? []
        list.push(link.addon_id)
        addonsByVariation.set(link.food_variation_id, list)
      }
    }

    variationsByFood = new Map()
    for (const v of variations) {
      const list = variationsByFood.get(v.food_id) ?? []
      list.push({
        id: v.id,
        title: v.title,
        price: v.price,
        discounted: v.discounted,
        isOutOfStock: !!v.is_out_of_stock,
        addons: addonsByVariation.get(v.id) ?? []
      })
      variationsByFood.set(v.food_id, list)
    }
  }

  const foodsByCategory = new Map<string, unknown[]>()
  for (const f of foods) {
    const list = foodsByCategory.get(f.category_id) ?? []
    list.push({
      id: f.id,
      title: f.title,
      description: f.description,
      image: f.image,
      isActive: !!f.is_active,
      isOutOfStock: !!f.is_out_of_stock,
      subCategory: f.sub_category_id,
      variations: variationsByFood.get(f.id) ?? [],
      createdAt: f.created_at,
      updatedAt: f.updated_at
    })
    foodsByCategory.set(f.category_id, list)
  }

  return categories.map((c) => ({
    id: c.id,
    title: c.title,
    image: c.image,
    foods: foodsByCategory.get(c.id) ?? [],
    createdAt: c.created_at,
    updatedAt: c.updated_at
  }))
}

async function loadOptions(db: D1Database, restaurantId: string) {
  const { results } = await db
    .prepare(
      'SELECT id, title, description, price FROM options WHERE restaurant_id = ?'
    )
    .bind(restaurantId)
    .all<{
      id: string
      title: string
      description: string | null
      price: number
    }>()
  return results.map((o) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    price: o.price,
    isOutOfStock: false
  }))
}

async function loadAddons(db: D1Database, restaurantId: string) {
  const { results: addons } = await db
    .prepare(
      `SELECT id, title, description, quantity_minimum, quantity_maximum
       FROM addons WHERE restaurant_id = ?`
    )
    .bind(restaurantId)
    .all<{
      id: string
      title: string
      description: string | null
      quantity_minimum: number
      quantity_maximum: number
    }>()

  const addonIds = addons.map((a) => a.id)
  const optionsByAddon = new Map<string, string[]>()
  if (addonIds.length > 0) {
    const placeholders = addonIds.map(() => '?').join(',')
    const { results: links } = await db
      .prepare(
        `SELECT addon_id, option_id FROM addon_options WHERE addon_id IN (${placeholders})`
      )
      .bind(...addonIds)
      .all<{ addon_id: string; option_id: string }>()
    for (const link of links) {
      const list = optionsByAddon.get(link.addon_id) ?? []
      list.push(link.option_id)
      optionsByAddon.set(link.addon_id, list)
    }
  }

  return addons.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    quantityMinimum: a.quantity_minimum,
    quantityMaximum: a.quantity_maximum,
    options: optionsByAddon.get(a.id) ?? []
  }))
}

async function loadRestaurantFull(
  db: D1Database,
  where: { id?: string; slug?: string }
) {
  const row = where.id
    ? await db
        .prepare('SELECT * FROM restaurants WHERE id = ?')
        .bind(where.id)
        .first<RestaurantRow>()
    : await db
        .prepare('SELECT * FROM restaurants WHERE slug = ?')
        .bind(where.slug)
        .first<RestaurantRow>()
  if (!row) return null

  const owner = await db
    .prepare('SELECT id, email, is_active FROM users WHERE id = ?')
    .bind(row.owner_id)
    .first<{ id: string; email: string | null; is_active: number }>()

  const zone = row.zone_id
    ? await db
        .prepare('SELECT id, title, tax FROM zones WHERE id = ?')
        .bind(row.zone_id)
        .first<{ id: string; title: string; tax: number }>()
    : null

  const [categories, options, addons] = await Promise.all([
    loadCategoriesTree(db, row.id),
    loadOptions(db, row.id),
    loadAddons(db, row.id)
  ])

  return {
    id: row.id,
    orderId: row.id,
    orderPrefix: row.order_prefix,
    isActive: !!row.is_active,
    name: row.name,
    image: row.image,
    logo: row.logo,
    slug: row.slug,
    username: row.username,
    phone: row.phone,
    shopType: row.shop_type,
    address: row.address,
    city: row.city,
    postCode: row.post_code,
    location: { coordinates: [row.lng ?? 0, row.lat ?? 0] },
    deliveryTime: row.delivery_time,
    minimumOrder: row.minimum_order,
    tax: row.tax,
    commissionRate: row.commission_rate,
    stripeDetailsSubmitted: !!row.stripe_details_submitted,
    reviewData: { total: 0, ratings: 0, reviews: [] },
    reviewAverage: row.review_average,
    categories,
    options,
    addons,
    zone: zone ? { id: zone.id, title: zone.title, tax: zone.tax } : null,
    rating: row.rating,
    isAvailable: !!row.is_available,
    openingTimes: mapOpeningTimes(row.opening_times),
    owner: owner
      ? { id: owner.id, email: owner.email, isActive: !!owner.is_active }
      : null,
    cuisines: parseJsonArray(row.cuisines),
    deliveryBounds: { coordinates: parseJsonArray(row.delivery_bounds) },
    deliveryInfo: {
      minDeliveryFee: row.min_delivery_fee,
      deliveryDistance: row.delivery_distance,
      deliveryFee: row.delivery_fee
    },
    bussinessDetails: {
      bankName: row.bank_name,
      accountName: row.account_name,
      accountCode: row.account_code,
      accountNumber: row.account_number,
      bussinessRegNo: row.business_reg_no,
      companyRegNo: row.company_reg_no,
      taxRate: row.business_tax_rate
    },
    currentWalletAmount: row.current_wallet_amount,
    totalWalletAmount: row.total_wallet_amount,
    withdrawnWalletAmount: row.withdrawn_wallet_amount
  }
}

async function requireOwnedRestaurant(
  ctx: GraphQLContext,
  restaurantId: string
) {
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

// ---------------------------------------------------------------------------
// GraphQL schema
// ---------------------------------------------------------------------------

export const catalogTypeDefs = /* GraphQL */ `
  extend type Query {
    restaurants: [RestaurantListItem!]!
    restaurantsPaginated(page: Int, limit: Int, search: String): RestaurantsPaginatedResult!
    restaurant(id: String, slug: String): Restaurant
    restaurantByOwner(id: String): [Restaurant!]!
    getRestaurantDeliveryZoneInfo(id: ID!): DeliveryZoneInfo
    getClonedRestaurants: [RestaurantListItem!]!
    getClonedRestaurantsPaginated(page: Int, limit: Int, search: String): RestaurantsPaginatedResult!
    restaurantCategoriesPaginated(restaurantId: String!, page: Int, limit: Int, search: String): CategoriesPaginatedResult!
    restaurantOptionsPaginated(restaurantId: String!, page: Int, limit: Int, search: String): OptionsPaginatedResult!
    restaurantAddonsPaginated(restaurantId: String!, page: Int, limit: Int, search: String): AddonsPaginatedResult!
    subCategories: [SubCategoryType!]!
    subCategory(id: String): SubCategoryType
    subCategoriesByParentId(parentCategoryId: String!): [SubCategoryType!]!
    nearByRestaurantsPreview(latitude: Float, longitude: Float, page: Int, limit: Int, shopType: String): NearByRestaurantsResult!
    recentOrderRestaurantsPreview(latitude: Float!, longitude: Float!): [RestaurantCarouselPreview!]!
    mostOrderedRestaurantsPreview(latitude: Float!, longitude: Float!, page: Int, limit: Int, shopType: String): [RestaurantCarouselPreview!]!
    nearByRestaurantsCuisines(latitude: Float, longitude: Float, shopType: String): [Cuisine!]!
    attachedCuisines: [Cuisine!]!
    cuisines: [Cuisine!]!
    fetchAllShopTypes: ShopTypesResult!
    relatedItems(itemId: String!, restaurantId: String!): [ID!]!
    fetchCategoryDetailsByStoreId(storeId: String!): [NavItem!]!
    popularItems(restaurantId: String!): [PopularItem!]!
  }

  extend type Mutation {
    submitPartnerRequest(input: PartnerRequestInput!): Boolean!

    createVendor(vendorInput: VendorInput): Vendor!
    editVendor(vendorInput: VendorInput): Vendor!
    deleteVendor(id: String!): Boolean!

    createRestaurant(restaurant: RestaurantInput!, owner: ID!): Restaurant!
    editRestaurant(restaurant: RestaurantProfileInput!): Restaurant!
    deleteRestaurant(id: String!): Restaurant!
    hardDeleteRestaurant(id: String!): Boolean!
    duplicateRestaurant(id: String!, owner: String!): Restaurant!
    updateDeliveryBoundsAndLocation(
      id: ID!
      boundType: String!
      bounds: [[[Float!]]]
      circleBounds: CircleBoundsInput
      location: CoordinatesInput!
      address: String
      postCode: String
      city: String
    ): MutationResult!
    updateRestaurantDelivery(id: ID!, minDeliveryFee: Float, deliveryDistance: Float, deliveryFee: Float): MutationResult!
    updateRestaurantBussinessDetails(id: String!, bussinessDetails: BussinessDetailsInput): MutationResult!
    updateTimings(id: String!, openingTimes: [TimingsInput]): Restaurant!

    createCategory(category: CategoryInput!): Restaurant!
    editCategory(category: CategoryInput!): Restaurant!
    deleteCategory(id: String!, restaurant: String!): Restaurant!
    createSubCategories(subCategories: [SubCategoryInput!]!): Boolean!
    deleteSubCategory(_id: String!): Boolean!

    createFood(foodInput: FoodInput!): Restaurant!
    editFood(foodInput: FoodInput!): Restaurant!
    deleteFood(id: String!, restaurant: String!, categoryId: String!): Food!
    updateFoodOutOfStock(id: String!, restaurant: String!, categoryId: String!): Boolean!

    createOptions(optionInput: CreateOptionInput): Restaurant!
    editOption(optionInput: editOptionInput): Restaurant!
    deleteOption(id: String!, restaurant: String!): Restaurant!

    createAddons(addonInput: AddonInput): Restaurant!
    editAddon(addonInput: editAddonInput): Restaurant!
    deleteAddon(id: String!, restaurant: String!): Restaurant!
  }

  type Vendor {
    id: ID!
    _id: ID!
    email: String
    name: String
    image: String
    firstName: String
    lastName: String
    phoneNumber: String
  }

  input PartnerRequestInput {
    requestType: String!
    firstName: String!
    lastName: String!
    email: String!
    phone: String
    password: String
  }

  input VendorInput {
    id: String
    name: String
    email: String
    password: String
    firstName: String
    lastName: String
    image: String
    phoneNumber: String
  }

  type Location {
    coordinates: [Float!]!
  }

  input CoordinatesInput {
    latitude: Float
    longitude: Float
  }

  input CircleBoundsInput {
    radius: Float
  }

  type TimeRange {
    startTime: [String!]
    endTime: [String!]
  }

  input TimeRangeInput {
    startTime: [String!]
    endTime: [String!]
  }

  type OpeningTime {
    day: String!
    times: [TimeRange!]!
  }

  input TimingsInput {
    day: String
    times: [TimeRangeInput!]
  }

  type RestaurantOwner {
    id: ID!
    email: String
    isActive: Boolean!
  }

  type Zone {
    id: ID!
    title: String!
    tax: Float!
  }

  type DeliveryBounds {
    coordinates: [[[Float!]]!]!
  }

  type DeliveryInfo {
    minDeliveryFee: Float
    deliveryDistance: Float
    deliveryFee: Float
  }

  input BussinessDetailsInput {
    bankName: String
    accountName: String
    accountCode: String
    accountNumber: String
    bussinessRegNo: String
    companyRegNo: String
    taxRate: Float
  }

  type BussinessDetails {
    bankName: String
    accountName: String
    accountCode: String
    accountNumber: String
    bussinessRegNo: String
    companyRegNo: String
    taxRate: Float
  }

  type ReviewUser {
    id: ID!
    name: String
    email: String
  }

  type ReviewOrder {
    user: ReviewUser
  }

  type RestaurantReview {
    id: ID!
    order: ReviewOrder
    rating: Float
    description: String
    createdAt: String
  }

  type ReviewData {
    total: Int!
    ratings: Float!
    reviews: [RestaurantReview!]!
  }

  type Variation {
    id: ID!
    title: String!
    price: Float!
    discounted: Float
    isOutOfStock: Boolean!
    addons: [ID!]!
  }

  input VariationInput {
    id: String
    title: String
    price: Float
    discounted: Float
    addons: [ID!]
    isOutOfStock: Boolean
  }

  type Food {
    id: ID!
    title: String!
    description: String
    image: String
    isActive: Boolean!
    isOutOfStock: Boolean!
    subCategory: ID
    variations: [Variation!]!
    createdAt: String
    updatedAt: String
  }

  input FoodInput {
    id: String
    restaurant: ID
    title: String
    description: String
    category: ID
    subCategory: ID
    image: String
    isActive: Boolean
    isOutOfStock: Boolean
    variations: [VariationInput!]
  }

  type Category {
    id: ID!
    title: String!
    image: String
    foods: [Food!]!
    createdAt: String
    updatedAt: String
  }

  input SubCategoryInput {
    title: String
    parentCategoryId: String
  }

  input CategoryInput {
    restaurant: ID
    id: String
    title: String
    subCategories: [SubCategoryInput!]
    image: String
  }

  type SubCategoryType {
    id: ID!
    title: String!
    parentCategoryId: ID!
  }

  type Option {
    id: ID!
    title: String!
    description: String
    price: Float!
    isOutOfStock: Boolean!
  }

  input OptionInput {
    id: String
    title: String
    description: String
    price: Float
  }

  input CreateOptionInput {
    restaurant: ID
    options: [OptionInput!]
  }

  input editOptionInput {
    restaurant: ID
    options: OptionInput
  }

  type Addon {
    id: ID!
    title: String!
    description: String
    quantityMinimum: Int!
    quantityMaximum: Int!
    options: [ID!]!
  }

  input AddonItemInput {
    id: String
    title: String
    description: String
    quantityMinimum: Int
    quantityMaximum: Int
    options: [ID!]
  }

  input AddonInput {
    restaurant: ID
    addons: [AddonItemInput!]
  }

  input editAddonInput {
    restaurant: ID
    addons: AddonItemInput
  }

  type Restaurant {
    id: ID!
    orderId: ID
    orderPrefix: String
    isActive: Boolean!
    name: String!
    image: String
    logo: String
    slug: String
    username: String
    phone: String
    shopType: String
    address: String
    city: String
    postCode: String
    location: Location!
    deliveryTime: Int
    minimumOrder: Float
    tax: Float
    commissionRate: Float
    stripeDetailsSubmitted: Boolean!
    reviewData: ReviewData!
    reviewAverage: Float
    categories: [Category!]!
    options: [Option!]!
    addons: [Addon!]!
    zone: Zone
    rating: Float
    isAvailable: Boolean!
    openingTimes: [OpeningTime!]!
    owner: RestaurantOwner
    cuisines: [String!]!
    deliveryBounds: DeliveryBounds!
    deliveryInfo: DeliveryInfo!
    bussinessDetails: BussinessDetails!
    currentWalletAmount: Float!
    totalWalletAmount: Float!
    withdrawnWalletAmount: Float!
  }

  input RestaurantInput {
    id: String
    name: String
    address: String
    phone: String
    image: String
    logo: String
    deliveryTime: Float
    minimumOrder: Float
    username: String
    password: String
    shopType: String
    salesTax: Float
    cuisines: [String!]
  }

  input RestaurantProfileInput {
    id: String
    name: String
    phone: String
    address: String
    image: String
    logo: String
    deliveryTime: Float
    minimumOrder: Float
    username: String
    shopType: String
    salesTax: Float
    orderPrefix: String
    cuisines: [String!]
    password: String
  }

  type RestaurantListItem {
    id: ID!
    orderId: ID
    orderPrefix: String
    name: String!
    image: String
    logo: String
    username: String
    slug: String
    address: String
    deliveryTime: Int
    minimumOrder: Float
    isActive: Boolean!
    commissionRate: Float
    tax: Float
    phone: String
    shopType: String
    location: Location!
    cuisines: [String!]!
  }

  type RestaurantsPaginatedResult {
    data: [RestaurantListItem!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  type CategoriesPaginatedResult {
    data: [Category!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  type OptionsPaginatedResult {
    data: [Option!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  type AddonsPaginatedResult {
    data: [Addon!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  type DeliveryZoneInfo {
    boundType: String
    deliveryBounds: DeliveryBounds!
    location: Location!
    circleBounds: CircleBounds
    address: String
    city: String
    postCode: String
  }

  type CircleBounds {
    radius: Float
  }

  type MutationResult {
    success: Boolean!
    message: String
    data: MutationResultData
  }

  type MutationResultData {
    id: ID!
    deliveryBounds: DeliveryBounds
    location: Location
  }

  type RestaurantPreview {
    id: ID!
    name: String!
    image: String
    logo: String
    slug: String
    shopType: String
    minimumOrder: Float
    deliveryTime: Int
    location: Location!
    reviewAverage: Float
    cuisines: [String!]!
    openingTimes: [OpeningTime!]!
    isAvailable: Boolean!
    isActive: Boolean!
  }

  type RestaurantCarouselPreview {
    id: ID!
    name: String!
    image: String
    logo: String
    slug: String
    shopType: String
    minimumOrder: Float
    deliveryTime: Int
    location: Location!
    reviewAverage: Float
    cuisines: [String!]!
    openingTimes: [OpeningTime!]!
    isAvailable: Boolean!
    isActive: Boolean!
  }

  type NearByRestaurantsResult {
    restaurants: [RestaurantPreview!]!
  }

  type Cuisine {
    id: ID!
    name: String!
    description: String
    image: String
    shopType: String
  }

  type ShopType {
    id: ID!
    image: String
    name: String!
    slug: String!
  }

  type ShopTypesResult {
    data: [ShopType!]!
  }

  type NavItem {
    id: ID!
    label: String!
    url: String!
    items: [NavItem!]!
  }

  type PopularItem {
    id: ID!
    count: Int!
  }
`

// ---------------------------------------------------------------------------
// Resolvers
// ---------------------------------------------------------------------------

export const catalogResolvers = {
  Query: {
    restaurants: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      const { results } = await ctx.env.DB.prepare(
        'SELECT * FROM restaurants ORDER BY created_at DESC'
      ).all<RestaurantRow>()
      return results.map(mapRestaurantListItem)
    },

    restaurantsPaginated: async (
      _p: unknown,
      args: { page?: number; limit?: number; search?: string },
      ctx: GraphQLContext
    ) => {
      const page = args.page ?? 1
      const limit = args.limit ?? 20
      const search = `%${args.search ?? ''}%`
      const { results } = await ctx.env.DB.prepare(
        `SELECT * FROM restaurants WHERE name LIKE ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
        .bind(search, limit, (page - 1) * limit)
        .all<RestaurantRow>()
      const total = await ctx.env.DB.prepare(
        'SELECT COUNT(*) as n FROM restaurants WHERE name LIKE ?'
      )
        .bind(search)
        .first<{ n: number }>()
      const totalCount = total?.n ?? 0
      return {
        data: results.map(mapRestaurantListItem),
        totalCount,
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(totalCount / limit))
      }
    },

    restaurant: async (
      _p: unknown,
      args: { id?: string; slug?: string },
      ctx: GraphQLContext
    ) => loadRestaurantFull(ctx.env.DB, args),

    restaurantByOwner: async (
      _p: unknown,
      args: { id?: string },
      ctx: GraphQLContext
    ) => {
      const ownerId = args.id ?? requireUser(ctx).sub
      const { results } = await ctx.env.DB.prepare(
        'SELECT id FROM restaurants WHERE owner_id = ?'
      )
        .bind(ownerId)
        .all<{ id: string }>()
      const restaurants = await Promise.all(
        results.map((r) => loadRestaurantFull(ctx.env.DB, { id: r.id }))
      )
      return restaurants.filter(Boolean)
    },

    getRestaurantDeliveryZoneInfo: async (
      _p: unknown,
      args: { id: string },
      ctx: GraphQLContext
    ) => {
      const row = await ctx.env.DB.prepare(
        'SELECT * FROM restaurants WHERE id = ?'
      )
        .bind(args.id)
        .first<RestaurantRow>()
      if (!row) return null
      return {
        boundType: row.bound_type,
        deliveryBounds: { coordinates: parseJsonArray(row.delivery_bounds) },
        location: { coordinates: [row.lng ?? 0, row.lat ?? 0] },
        circleBounds: { radius: row.circle_radius },
        address: row.address,
        city: row.city,
        postCode: row.post_code
      }
    },

    getClonedRestaurants: async () => [],
    getClonedRestaurantsPaginated: async (
      _p: unknown,
      args: { page?: number; limit?: number }
    ) => ({
      data: [],
      totalCount: 0,
      currentPage: args.page ?? 1,
      totalPages: 1
    }),

    restaurantCategoriesPaginated: async (
      _p: unknown,
      args: {
        restaurantId: string
        page?: number
        limit?: number
      },
      ctx: GraphQLContext
    ) => {
      const categories = await loadCategoriesTree(
        ctx.env.DB,
        args.restaurantId
      )
      return {
        data: categories,
        totalCount: categories.length,
        currentPage: args.page ?? 1,
        totalPages: 1
      }
    },

    restaurantOptionsPaginated: async (
      _p: unknown,
      args: { restaurantId: string; page?: number },
      ctx: GraphQLContext
    ) => {
      const options = await loadOptions(ctx.env.DB, args.restaurantId)
      return {
        data: options,
        totalCount: options.length,
        currentPage: args.page ?? 1,
        totalPages: 1
      }
    },

    restaurantAddonsPaginated: async (
      _p: unknown,
      args: { restaurantId: string; page?: number },
      ctx: GraphQLContext
    ) => {
      const addons = await loadAddons(ctx.env.DB, args.restaurantId)
      return {
        data: addons,
        totalCount: addons.length,
        currentPage: args.page ?? 1,
        totalPages: 1
      }
    },

    subCategories: async (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      const { results } = await ctx.env.DB.prepare(
        'SELECT id, title, parent_category_id FROM sub_categories'
      ).all<{ id: string; title: string; parent_category_id: string }>()
      return results.map((s) => ({
        id: s.id,
        title: s.title,
        parentCategoryId: s.parent_category_id
      }))
    },

    subCategory: async (
      _p: unknown,
      args: { id?: string },
      ctx: GraphQLContext
    ) => {
      if (!args.id) return null
      const s = await ctx.env.DB.prepare(
        'SELECT id, title, parent_category_id FROM sub_categories WHERE id = ?'
      )
        .bind(args.id)
        .first<{ id: string; title: string; parent_category_id: string }>()
      return s
        ? { id: s.id, title: s.title, parentCategoryId: s.parent_category_id }
        : null
    },

    subCategoriesByParentId: async (
      _p: unknown,
      args: { parentCategoryId: string },
      ctx: GraphQLContext
    ) => {
      const { results } = await ctx.env.DB.prepare(
        'SELECT id, title, parent_category_id FROM sub_categories WHERE parent_category_id = ?'
      )
        .bind(args.parentCategoryId)
        .all<{ id: string; title: string; parent_category_id: string }>()
      return results.map((s) => ({
        id: s.id,
        title: s.title,
        parentCategoryId: s.parent_category_id
      }))
    },

    nearByRestaurantsPreview: async (
      _p: unknown,
      args: { page?: number; limit?: number; shopType?: string },
      ctx: GraphQLContext
    ) => {
      const limit = args.limit ?? 20
      const offset = ((args.page ?? 1) - 1) * limit
      const { results } = args.shopType
        ? await ctx.env.DB.prepare(
            `SELECT * FROM restaurants WHERE is_active = 1 AND shop_type = ?
             ORDER BY created_at DESC LIMIT ? OFFSET ?`
          )
            .bind(args.shopType, limit, offset)
            .all<RestaurantRow>()
        : await ctx.env.DB.prepare(
            `SELECT * FROM restaurants WHERE is_active = 1
             ORDER BY created_at DESC LIMIT ? OFFSET ?`
          )
            .bind(limit, offset)
            .all<RestaurantRow>()
      return { restaurants: results.map(mapRestaurantPreview) }
    },

    recentOrderRestaurantsPreview: async () => [],
    mostOrderedRestaurantsPreview: async (
      _p: unknown,
      args: { shopType?: string; limit?: number },
      ctx: GraphQLContext
    ) => {
      const limit = args.limit ?? 10
      const { results } = args.shopType
        ? await ctx.env.DB.prepare(
            `SELECT * FROM restaurants WHERE is_active = 1 AND shop_type = ?
             ORDER BY review_average DESC LIMIT ?`
          )
            .bind(args.shopType, limit)
            .all<RestaurantRow>()
        : await ctx.env.DB.prepare(
            `SELECT * FROM restaurants WHERE is_active = 1
             ORDER BY review_average DESC LIMIT ?`
          )
            .bind(limit)
            .all<RestaurantRow>()
      return results.map(mapRestaurantPreview)
    },

    nearByRestaurantsCuisines: async (
      _p: unknown,
      args: { shopType?: string },
      ctx: GraphQLContext
    ) => loadCuisines(ctx.env.DB, args.shopType),
    attachedCuisines: async (_p: unknown, _a: unknown, ctx: GraphQLContext) =>
      loadCuisines(ctx.env.DB),
    cuisines: async (_p: unknown, _a: unknown, ctx: GraphQLContext) =>
      loadCuisines(ctx.env.DB),

    fetchAllShopTypes: async (
      _p: unknown,
      _a: unknown,
      ctx: GraphQLContext
    ) => {
      const { results } = await ctx.env.DB.prepare(
        'SELECT id, image, name, slug FROM shop_types ORDER BY sort_order ASC'
      ).all<{ id: string; image: string | null; name: string; slug: string }>()
      return { data: results }
    },

    relatedItems: async () => [],

    fetchCategoryDetailsByStoreId: async (
      _p: unknown,
      args: { storeId: string },
      ctx: GraphQLContext
    ) => {
      const categories = await loadCategoriesTree(ctx.env.DB, args.storeId)
      const { results: subCategories } = await ctx.env.DB.prepare(
        `SELECT sc.id, sc.title, sc.parent_category_id FROM sub_categories sc
         JOIN categories c ON c.id = sc.parent_category_id
         WHERE c.restaurant_id = ?`
      )
        .bind(args.storeId)
        .all<{ id: string; title: string; parent_category_id: string }>()
      const subsByParent = new Map<string, typeof subCategories>()
      for (const s of subCategories) {
        const list = subsByParent.get(s.parent_category_id) ?? []
        list.push(s)
        subsByParent.set(s.parent_category_id, list)
      }
      return categories.map((c) => ({
        id: c.id,
        label: c.title,
        url: `/category/${c.id}`,
        items: (subsByParent.get(c.id) ?? []).map((s) => ({
          id: s.id,
          label: s.title,
          url: `/category/${c.id}/${s.id}`,
          items: []
        }))
      }))
    },

    popularItems: async () => []
  },

  Mutation: {
    submitPartnerRequest: async (
      _p: unknown,
      args: {
        input: {
          requestType: string
          firstName: string
          lastName: string
          email: string
          phone?: string
          password?: string
        }
      },
      ctx: GraphQLContext
    ) => {
      const { input } = args
      if (input.requestType !== 'rider' && input.requestType !== 'vendor') {
        throw new Error('requestType must be "rider" or "vendor"')
      }
      const passwordHash = input.password
        ? await hashPassword(input.password)
        : null
      await ctx.env.DB.prepare(
        `INSERT INTO partner_requests (id, request_type, first_name, last_name, email, phone, password_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          newId(),
          input.requestType,
          input.firstName,
          input.lastName,
          input.email.toLowerCase(),
          input.phone ?? null,
          passwordHash
        )
        .run()
      return true
    },

    createVendor: async (
      _p: unknown,
      args: { vendorInput: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      const input = args.vendorInput ?? {}
      const id = (input.id as string) || newId()
      const email = ((input.email as string) ?? '').toLowerCase()
      const passwordHash = input.password
        ? await hashPassword(input.password as string)
        : null
      const name =
        (input.name as string) ||
        [input.firstName, input.lastName].filter(Boolean).join(' ') ||
        email.split('@')[0]
      await ctx.env.DB.prepare(
        `INSERT INTO users (id, email, password_hash, role, name, first_name, last_name, phone, image_url)
         VALUES (?, ?, ?, 'vendor', ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           email = excluded.email, name = excluded.name,
           first_name = excluded.first_name, last_name = excluded.last_name,
           phone = excluded.phone, image_url = excluded.image_url`
      )
        .bind(
          id,
          email || null,
          passwordHash,
          name,
          (input.firstName as string) ?? null,
          (input.lastName as string) ?? null,
          (input.phoneNumber as string) ?? null,
          (input.image as string) ?? null
        )
        .run()
      return {
        id,
        _id: id,
        email,
        name,
        image: input.image ?? null,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        phoneNumber: input.phoneNumber ?? null
      }
    },

    editVendor: async (
      _p: unknown,
      args: { vendorInput: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      const input = args.vendorInput ?? {}
      const id = input.id as string
      if (!id) throw new Error('id is required')
      await ctx.env.DB.prepare(
        `UPDATE users SET
           email = COALESCE(?, email), name = COALESCE(?, name),
           first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name),
           phone = COALESCE(?, phone), image_url = COALESCE(?, image_url)
         WHERE id = ?`
      )
        .bind(
          input.email ?? null,
          input.name ?? null,
          input.firstName ?? null,
          input.lastName ?? null,
          input.phoneNumber ?? null,
          input.image ?? null,
          id
        )
        .run()
      const user = await ctx.env.DB.prepare(
        'SELECT id, email, name, first_name, last_name, phone, image_url FROM users WHERE id = ?'
      )
        .bind(id)
        .first<{
          id: string
          email: string | null
          name: string
          first_name: string | null
          last_name: string | null
          phone: string | null
          image_url: string | null
        }>()
      return {
        id: user!.id,
        _id: user!.id,
        email: user!.email,
        name: user!.name,
        image: user!.image_url,
        firstName: user!.first_name,
        lastName: user!.last_name,
        phoneNumber: user!.phone
      }
    },

    deleteVendor: async (
      _p: unknown,
      args: { id: string },
      ctx: GraphQLContext
    ) => {
      await ctx.env.DB.prepare('DELETE FROM users WHERE id = ? AND role = ?')
        .bind(args.id, 'vendor')
        .run()
      return true
    },

    createRestaurant: async (
      _p: unknown,
      args: { restaurant: Record<string, unknown>; owner: string },
      ctx: GraphQLContext
    ) => {
      const input = args.restaurant
      const id = (input.id as string) || newId()
      const passwordHash = input.password
        ? await hashPassword(input.password as string)
        : null
      await ctx.env.DB.prepare(
        `INSERT INTO restaurants (
           id, owner_id, name, address, phone, image, logo, delivery_time,
           minimum_order, username, password_hash, shop_type, sales_tax, cuisines
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          id,
          args.owner,
          input.name,
          input.address ?? null,
          input.phone ?? null,
          input.image ?? null,
          input.logo ?? null,
          input.deliveryTime ?? 30,
          input.minimumOrder ?? 0,
          input.username ?? null,
          passwordHash,
          input.shopType ?? null,
          input.salesTax ?? 0,
          JSON.stringify(input.cuisines ?? [])
        )
        .run()
      return loadRestaurantFull(ctx.env.DB, { id })
    },

    editRestaurant: async (
      _p: unknown,
      args: { restaurant: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      const input = args.restaurant
      const id = input.id as string
      await requireOwnedRestaurant(ctx, id)
      const passwordHash = input.password
        ? await hashPassword(input.password as string)
        : null
      await ctx.env.DB.prepare(
        `UPDATE restaurants SET
           name = COALESCE(?, name), phone = COALESCE(?, phone),
           address = COALESCE(?, address), image = COALESCE(?, image),
           logo = COALESCE(?, logo), delivery_time = COALESCE(?, delivery_time),
           minimum_order = COALESCE(?, minimum_order), username = COALESCE(?, username),
           shop_type = COALESCE(?, shop_type), sales_tax = COALESCE(?, sales_tax),
           order_prefix = COALESCE(?, order_prefix),
           cuisines = COALESCE(?, cuisines),
           password_hash = COALESCE(?, password_hash),
           updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(
          input.name ?? null,
          input.phone ?? null,
          input.address ?? null,
          input.image ?? null,
          input.logo ?? null,
          input.deliveryTime ?? null,
          input.minimumOrder ?? null,
          input.username ?? null,
          input.shopType ?? null,
          input.salesTax ?? null,
          input.orderPrefix ?? null,
          input.cuisines ? JSON.stringify(input.cuisines) : null,
          passwordHash,
          id
        )
        .run()
      return loadRestaurantFull(ctx.env.DB, { id })
    },

    deleteRestaurant: async (
      _p: unknown,
      args: { id: string },
      ctx: GraphQLContext
    ) => {
      await requireOwnedRestaurant(ctx, args.id)
      await ctx.env.DB.prepare(
        'UPDATE restaurants SET is_active = 0 WHERE id = ?'
      )
        .bind(args.id)
        .run()
      return loadRestaurantFull(ctx.env.DB, { id: args.id })
    },

    hardDeleteRestaurant: async (
      _p: unknown,
      args: { id: string },
      ctx: GraphQLContext
    ) => {
      await requireOwnedRestaurant(ctx, args.id)
      await ctx.env.DB.prepare('DELETE FROM restaurants WHERE id = ?')
        .bind(args.id)
        .run()
      return true
    },

    duplicateRestaurant: async (
      _p: unknown,
      args: { id: string; owner: string },
      ctx: GraphQLContext
    ) => {
      const source = await ctx.env.DB.prepare(
        'SELECT * FROM restaurants WHERE id = ?'
      )
        .bind(args.id)
        .first<RestaurantRow>()
      if (!source) throw new Error('Restaurant not found')
      const id = newId()
      await ctx.env.DB.prepare(
        `INSERT INTO restaurants (
           id, owner_id, name, address, phone, image, logo, delivery_time,
           minimum_order, shop_type, sales_tax, cuisines
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          id,
          args.owner,
          `${source.name} (copy)`,
          source.address,
          source.phone,
          source.image,
          source.logo,
          source.delivery_time,
          source.minimum_order,
          source.shop_type,
          source.sales_tax,
          source.cuisines
        )
        .run()
      return loadRestaurantFull(ctx.env.DB, { id })
    },

    updateDeliveryBoundsAndLocation: async (
      _p: unknown,
      args: {
        id: string
        boundType: string
        bounds?: number[][][]
        circleBounds?: { radius: number }
        location: { latitude: number; longitude: number }
        address?: string
        postCode?: string
        city?: string
      },
      ctx: GraphQLContext
    ) => {
      await requireOwnedRestaurant(ctx, args.id)
      await ctx.env.DB.prepare(
        `UPDATE restaurants SET
           bound_type = ?, delivery_bounds = ?, circle_radius = ?,
           lat = ?, lng = ?, address = COALESCE(?, address),
           post_code = COALESCE(?, post_code), city = COALESCE(?, city),
           updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(
          args.boundType,
          JSON.stringify(args.bounds ?? []),
          args.circleBounds?.radius ?? null,
          args.location.latitude,
          args.location.longitude,
          args.address ?? null,
          args.postCode ?? null,
          args.city ?? null,
          args.id
        )
        .run()
      return {
        success: true,
        message: 'Delivery zone updated',
        data: {
          id: args.id,
          deliveryBounds: { coordinates: args.bounds ?? [] },
          location: {
            coordinates: [args.location.longitude, args.location.latitude]
          }
        }
      }
    },

    updateRestaurantDelivery: async (
      _p: unknown,
      args: {
        id: string
        minDeliveryFee?: number
        deliveryDistance?: number
        deliveryFee?: number
      },
      ctx: GraphQLContext
    ) => {
      await requireOwnedRestaurant(ctx, args.id)
      await ctx.env.DB.prepare(
        `UPDATE restaurants SET
           min_delivery_fee = COALESCE(?, min_delivery_fee),
           delivery_distance = COALESCE(?, delivery_distance),
           delivery_fee = COALESCE(?, delivery_fee),
           updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(
          args.minDeliveryFee ?? null,
          args.deliveryDistance ?? null,
          args.deliveryFee ?? null,
          args.id
        )
        .run()
      return {
        success: true,
        message: 'Delivery settings updated',
        data: { id: args.id }
      }
    },

    updateRestaurantBussinessDetails: async (
      _p: unknown,
      args: { id: string; bussinessDetails: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      await requireOwnedRestaurant(ctx, args.id)
      const b = args.bussinessDetails ?? {}
      await ctx.env.DB.prepare(
        `UPDATE restaurants SET
           bank_name = COALESCE(?, bank_name), account_name = COALESCE(?, account_name),
           account_code = COALESCE(?, account_code), account_number = COALESCE(?, account_number),
           business_reg_no = COALESCE(?, business_reg_no), company_reg_no = COALESCE(?, company_reg_no),
           business_tax_rate = COALESCE(?, business_tax_rate),
           updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(
          b.bankName ?? null,
          b.accountName ?? null,
          b.accountCode ?? null,
          b.accountNumber ?? null,
          b.bussinessRegNo ?? null,
          b.companyRegNo ?? null,
          b.taxRate ?? null,
          args.id
        )
        .run()
      return {
        success: true,
        message: 'Business details updated',
        data: { id: args.id }
      }
    },

    updateTimings: async (
      _p: unknown,
      args: { id: string; openingTimes: unknown[] },
      ctx: GraphQLContext
    ) => {
      await requireOwnedRestaurant(ctx, args.id)
      await ctx.env.DB.prepare(
        "UPDATE restaurants SET opening_times = ?, updated_at = datetime('now') WHERE id = ?"
      )
        .bind(JSON.stringify(args.openingTimes ?? []), args.id)
        .run()
      return loadRestaurantFull(ctx.env.DB, { id: args.id })
    },

    createCategory: async (
      _p: unknown,
      args: { category: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      const input = args.category
      const restaurantId = input.restaurant as string
      await requireOwnedRestaurant(ctx, restaurantId)
      const id = (input.id as string) || newId()
      await ctx.env.DB.prepare(
        'INSERT INTO categories (id, restaurant_id, title, image) VALUES (?, ?, ?, ?)'
      )
        .bind(id, restaurantId, input.title, (input.image as string) || null)
        .run()
      const subCategories =
        (input.subCategories as { title: string }[] | undefined) ?? []
      for (const sub of subCategories) {
        await ctx.env.DB.prepare(
          'INSERT INTO sub_categories (id, parent_category_id, title) VALUES (?, ?, ?)'
        )
          .bind(newId(), id, sub.title)
          .run()
      }
      return loadRestaurantFull(ctx.env.DB, { id: restaurantId })
    },

    editCategory: async (
      _p: unknown,
      args: { category: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      const input = args.category
      const restaurantId = input.restaurant as string
      await requireOwnedRestaurant(ctx, restaurantId)
      await ctx.env.DB.prepare(
        `UPDATE categories SET title = COALESCE(?, title), image = COALESCE(?, image),
         updated_at = datetime('now') WHERE id = ?`
      )
        .bind(input.title ?? null, input.image ?? null, input.id)
        .run()
      return loadRestaurantFull(ctx.env.DB, { id: restaurantId })
    },

    deleteCategory: async (
      _p: unknown,
      args: { id: string; restaurant: string },
      ctx: GraphQLContext
    ) => {
      await requireOwnedRestaurant(ctx, args.restaurant)
      await ctx.env.DB.prepare('DELETE FROM categories WHERE id = ?')
        .bind(args.id)
        .run()
      return loadRestaurantFull(ctx.env.DB, { id: args.restaurant })
    },

    createSubCategories: async (
      _p: unknown,
      args: { subCategories: { title: string; parentCategoryId: string }[] },
      ctx: GraphQLContext
    ) => {
      for (const sub of args.subCategories) {
        await ctx.env.DB.prepare(
          'INSERT INTO sub_categories (id, parent_category_id, title) VALUES (?, ?, ?)'
        )
          .bind(newId(), sub.parentCategoryId, sub.title)
          .run()
      }
      return true
    },

    deleteSubCategory: async (
      _p: unknown,
      args: { _id: string },
      ctx: GraphQLContext
    ) => {
      await ctx.env.DB.prepare('DELETE FROM sub_categories WHERE id = ?')
        .bind(args._id)
        .run()
      return true
    },

    createFood: async (
      _p: unknown,
      args: { foodInput: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      const input = args.foodInput
      const restaurantId = input.restaurant as string
      await requireOwnedRestaurant(ctx, restaurantId)
      const id = (input.id as string) || newId()
      await ctx.env.DB.prepare(
        `INSERT INTO foods (id, restaurant_id, category_id, sub_category_id, title, description, image, is_active, is_out_of_stock)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          id,
          restaurantId,
          input.category,
          (input.subCategory as string) ?? null,
          input.title,
          (input.description as string) ?? null,
          (input.image as string) ?? null,
          input.isActive === false ? 0 : 1,
          input.isOutOfStock ? 1 : 0
        )
        .run()
      await saveVariations(
        ctx.env.DB,
        id,
        (input.variations as Record<string, unknown>[]) ?? []
      )
      return loadRestaurantFull(ctx.env.DB, { id: restaurantId })
    },

    editFood: async (
      _p: unknown,
      args: { foodInput: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      const input = args.foodInput
      const restaurantId = input.restaurant as string
      await requireOwnedRestaurant(ctx, restaurantId)
      const id = input.id as string
      await ctx.env.DB.prepare(
        `UPDATE foods SET
           category_id = COALESCE(?, category_id), sub_category_id = COALESCE(?, sub_category_id),
           title = COALESCE(?, title), description = COALESCE(?, description),
           image = COALESCE(?, image), is_active = COALESCE(?, is_active),
           is_out_of_stock = COALESCE(?, is_out_of_stock), updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(
          input.category ?? null,
          input.subCategory ?? null,
          input.title ?? null,
          input.description ?? null,
          input.image ?? null,
          input.isActive === undefined ? null : input.isActive ? 1 : 0,
          input.isOutOfStock === undefined ? null : input.isOutOfStock ? 1 : 0,
          id
        )
        .run()
      if (input.variations) {
        await ctx.env.DB.prepare(
          'DELETE FROM food_variations WHERE food_id = ?'
        )
          .bind(id)
          .run()
        await saveVariations(
          ctx.env.DB,
          id,
          input.variations as Record<string, unknown>[]
        )
      }
      return loadRestaurantFull(ctx.env.DB, { id: restaurantId })
    },

    deleteFood: async (
      _p: unknown,
      args: { id: string; restaurant: string },
      ctx: GraphQLContext
    ) => {
      await requireOwnedRestaurant(ctx, args.restaurant)
      await ctx.env.DB.prepare('DELETE FROM foods WHERE id = ?')
        .bind(args.id)
        .run()
      return { id: args.id }
    },

    updateFoodOutOfStock: async (
      _p: unknown,
      args: { id: string; restaurant: string },
      ctx: GraphQLContext
    ) => {
      await requireOwnedRestaurant(ctx, args.restaurant)
      await ctx.env.DB.prepare(
        'UPDATE foods SET is_out_of_stock = NOT is_out_of_stock WHERE id = ?'
      )
        .bind(args.id)
        .run()
      return true
    },

    createOptions: async (
      _p: unknown,
      args: { optionInput: { restaurant: string; options: Record<string, unknown>[] } },
      ctx: GraphQLContext
    ) => {
      const { restaurant, options } = args.optionInput
      await requireOwnedRestaurant(ctx, restaurant)
      for (const opt of options) {
        await ctx.env.DB.prepare(
          'INSERT INTO options (id, restaurant_id, title, description, price) VALUES (?, ?, ?, ?, ?)'
        )
          .bind(
            newId(),
            restaurant,
            opt.title,
            (opt.description as string) ?? null,
            (opt.price as number) ?? 0
          )
          .run()
      }
      return loadRestaurantFull(ctx.env.DB, { id: restaurant })
    },

    editOption: async (
      _p: unknown,
      args: { optionInput: { restaurant: string; options: Record<string, unknown> } },
      ctx: GraphQLContext
    ) => {
      const { restaurant, options } = args.optionInput
      await requireOwnedRestaurant(ctx, restaurant)
      await ctx.env.DB.prepare(
        `UPDATE options SET title = COALESCE(?, title),
         description = COALESCE(?, description), price = COALESCE(?, price)
         WHERE id = ?`
      )
        .bind(
          options.title ?? null,
          options.description ?? null,
          options.price ?? null,
          options.id
        )
        .run()
      return loadRestaurantFull(ctx.env.DB, { id: restaurant })
    },

    deleteOption: async (
      _p: unknown,
      args: { id: string; restaurant: string },
      ctx: GraphQLContext
    ) => {
      await requireOwnedRestaurant(ctx, args.restaurant)
      await ctx.env.DB.prepare('DELETE FROM options WHERE id = ?')
        .bind(args.id)
        .run()
      return loadRestaurantFull(ctx.env.DB, { id: args.restaurant })
    },

    createAddons: async (
      _p: unknown,
      args: {
        addonInput: {
          restaurant: string
          addons: Record<string, unknown>[]
        }
      },
      ctx: GraphQLContext
    ) => {
      const { restaurant, addons } = args.addonInput
      await requireOwnedRestaurant(ctx, restaurant)
      for (const addon of addons) {
        const id = newId()
        await ctx.env.DB.prepare(
          `INSERT INTO addons (id, restaurant_id, title, description, quantity_minimum, quantity_maximum)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
          .bind(
            id,
            restaurant,
            addon.title,
            (addon.description as string) ?? null,
            (addon.quantityMinimum as number) ?? 0,
            (addon.quantityMaximum as number) ?? 1
          )
          .run()
        await linkAddonOptions(
          ctx.env.DB,
          id,
          (addon.options as string[]) ?? []
        )
      }
      return loadRestaurantFull(ctx.env.DB, { id: restaurant })
    },

    editAddon: async (
      _p: unknown,
      args: {
        addonInput: { restaurant: string; addons: Record<string, unknown> }
      },
      ctx: GraphQLContext
    ) => {
      const { restaurant, addons } = args.addonInput
      await requireOwnedRestaurant(ctx, restaurant)
      const id = addons.id as string
      await ctx.env.DB.prepare(
        `UPDATE addons SET title = COALESCE(?, title), description = COALESCE(?, description),
         quantity_minimum = COALESCE(?, quantity_minimum), quantity_maximum = COALESCE(?, quantity_maximum)
         WHERE id = ?`
      )
        .bind(
          addons.title ?? null,
          addons.description ?? null,
          addons.quantityMinimum ?? null,
          addons.quantityMaximum ?? null,
          id
        )
        .run()
      if (addons.options) {
        await ctx.env.DB.prepare(
          'DELETE FROM addon_options WHERE addon_id = ?'
        )
          .bind(id)
          .run()
        await linkAddonOptions(ctx.env.DB, id, addons.options as string[])
      }
      return loadRestaurantFull(ctx.env.DB, { id: restaurant })
    },

    deleteAddon: async (
      _p: unknown,
      args: { id: string; restaurant: string },
      ctx: GraphQLContext
    ) => {
      await requireOwnedRestaurant(ctx, args.restaurant)
      await ctx.env.DB.prepare('DELETE FROM addons WHERE id = ?')
        .bind(args.id)
        .run()
      return loadRestaurantFull(ctx.env.DB, { id: args.restaurant })
    }
  }
}

async function saveVariations(
  db: D1Database,
  foodId: string,
  variations: Record<string, unknown>[]
) {
  let sortOrder = 0
  for (const variation of variations) {
    const variationId = (variation.id as string) || newId()
    await db
      .prepare(
        `INSERT INTO food_variations (id, food_id, title, price, discounted, is_out_of_stock, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        variationId,
        foodId,
        variation.title,
        variation.price ?? 0,
        variation.discounted ?? null,
        variation.isOutOfStock ? 1 : 0,
        sortOrder++
      )
      .run()
    for (const addonId of (variation.addons as string[]) ?? []) {
      await db
        .prepare(
          'INSERT INTO food_variation_addons (food_variation_id, addon_id) VALUES (?, ?)'
        )
        .bind(variationId, addonId)
        .run()
    }
  }
}

async function linkAddonOptions(
  db: D1Database,
  addonId: string,
  optionIds: string[]
) {
  for (const optionId of optionIds) {
    await db
      .prepare(
        'INSERT OR IGNORE INTO addon_options (addon_id, option_id) VALUES (?, ?)'
      )
      .bind(addonId, optionId)
      .run()
  }
}

function mapRestaurantPreview(r: RestaurantRow) {
  return {
    id: r.id,
    name: r.name,
    image: r.image,
    logo: r.logo,
    slug: r.slug,
    shopType: r.shop_type,
    minimumOrder: r.minimum_order,
    deliveryTime: r.delivery_time,
    location: { coordinates: [r.lng ?? 0, r.lat ?? 0] },
    reviewAverage: r.review_average,
    cuisines: parseJsonArray(r.cuisines),
    openingTimes: mapOpeningTimes(r.opening_times),
    isAvailable: !!r.is_available,
    isActive: !!r.is_active
  }
}

async function loadCuisines(db: D1Database, shopType?: string) {
  const { results } = shopType
    ? await db
        .prepare('SELECT * FROM cuisines WHERE shop_type = ?')
        .bind(shopType)
        .all<{
          id: string
          name: string
          description: string | null
          image: string | null
          shop_type: string | null
        }>()
    : await db.prepare('SELECT * FROM cuisines').all<{
        id: string
        name: string
        description: string | null
        image: string | null
        shop_type: string | null
      }>()
  return results.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    image: c.image,
    shopType: c.shop_type
  }))
}

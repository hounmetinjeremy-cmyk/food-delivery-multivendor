const typeDefs = /* GraphQL */ `
  scalar JSON

  type Location {
    coordinates: [Float]
  }

  type OpeningTime {
    startTime: String
    endTime: String
  }

  type OpeningHour {
    day: String
    times: [OpeningTime]
  }

  type Address {
    _id: ID
    deliveryAddress: String
    details: String
    label: String
    location: Location
    selected: Boolean
  }

  type User {
    _id: ID
    name: String
    phone: String
    phoneIsVerified: Boolean
    email: String
    emailIsVerified: Boolean
    isActive: Boolean
    isOrderNotification: Boolean
    isOfferNotification: Boolean
    createdAt: String
    updatedAt: String
    addresses: [Address]
    notificationToken: String
    favourite: [ID]
    userType: String
  }

  type Rider {
    _id: ID
    name: String
    email: String
    username: String
    phone: String
    image: String
    available: Boolean
    isActive: Boolean
    createdAt: String
    updatedAt: String
    accountNumber: String
    currentWalletAmount: Float
    totalWalletAmount: Float
    withdrawnWalletAmount: Float
    location: Location
  }

  type Owner {
    _id: ID
    email: String
  }

  type Zone {
    _id: ID
    title: String
    tax: Float
    description: String
    location: Location
    isActive: Boolean
  }

  type Variation {
    _id: ID
    title: String
    price: Float
    discounted: Float
    addons: JSON
    isOutOfStock: Boolean
  }

  type Food {
    _id: ID
    title: String
    description: String
    image: String
    subCategory: String
    isActive: Boolean
    isOutOfStock: Boolean
    createdAt: String
    updatedAt: String
    variations: [Variation]
  }

  type Category {
    _id: ID
    title: String
    foods: [Food]
    createdAt: String
    updatedAt: String
  }

  type RestaurantOption {
    _id: ID
    title: String
    description: String
    price: Float
  }

  type Addon {
    _id: ID
    options: JSON
    title: String
    description: String
    quantityMinimum: Int
    quantityMaximum: Int
  }

  type Review {
    _id: ID
    rating: Int
    description: String
    isActive: Boolean
    createdAt: String
    updatedAt: String
    order: Order
  }

  type ReviewData {
    reviews: [Review]
    ratings: Float
    total: Int
  }

  type Restaurant {
    _id: ID
    orderId: Int
    orderPrefix: String
    name: String
    image: String
    logo: String
    address: String
    location: Location
    categories: [Category]
    options: [RestaurantOption]
    addons: [Addon]
    reviewData: ReviewData
    zone: Zone
    username: String
    deliveryTime: Int
    minimumOrder: Float
    sections: JSON
    rating: Float
    isActive: Boolean
    isAvailable: Boolean
    openingTimes: [OpeningHour]
    slug: String
    stripeDetailsSubmitted: Boolean
    owner: Owner
    deliveryBounds: JSON
    tax: Float
    notificationToken: String
    enableNotification: Boolean
    shopType: String
    freeDelivery: Boolean
    acceptVouchers: Boolean
    cuisines: [String]
    tags: [String]
    reviewCount: Int
    reviewAverage: Float
    distanceWithCurrentLocation: Float
    phone: String
    restaurantUrl: String
  }

  type RestaurantCarouselPreview {
    _id: ID
    name: String
    image: String
    logo: String
    deliveryTime: Int
    minimumOrder: Float
    tax: Float
    isAvailable: Boolean
    shopType: String
    tags: [String]
    reviewCount: Int
    reviewAverage: Float
    location: Location
    openingTimes: [OpeningHour]
  }

  type Offer {
    _id: ID
    name: String
    tag: String
    restaurants: JSON
  }

  type Section {
    _id: ID
    name: String
    restaurants: JSON
  }

  type NearByRestaurantsResult {
    offers: [Offer]
    sections: [Section]
    restaurants: [Restaurant]
  }

  type NearByRestaurantsPreviewResult {
    offers: [Offer]
    sections: [Section]
    restaurants: [Restaurant]
  }

  type OrderItemAddonOption {
    _id: ID
    title: String
    description: String
    price: Float
  }

  type OrderItemVariation {
    _id: ID
    title: String
    price: Float
    discounted: Float
  }

  type OrderItemAddon {
    _id: ID
    options: [OrderItemAddonOption]
    title: String
    description: String
    quantityMinimum: Int
    quantityMaximum: Int
  }

  type OrderItem {
    _id: ID
    id: ID
    title: String
    food: String
    description: String
    image: String
    quantity: Int
    variation: OrderItemVariation
    addons: [OrderItemAddon]
    specialInstructions: String
    isActive: Boolean
    createdAt: String
    updatedAt: String
  }

  type OrderDeliveryAddress {
    location: Location
    deliveryAddress: String
    details: String
    label: String
    id: ID
  }

  type Eta {
    phase: String
    source: String
    readyAt: String
    baseArrivalAt: String
    estimatedArrivalAt: String
    windowStartAt: String
    windowEndAt: String
    durationSeconds: Int
    distanceMeters: Float
    encodedPolyline: String
    calculatedAt: String
    lastLocationAt: String
    version: Int
  }

  type Order {
    _id: ID
    orderId: String
    id: ID
    orderPrefix: String
    restaurant: Restaurant
    deliveryAddress: OrderDeliveryAddress
    items: [OrderItem]
    user: User
    rider: Rider
    review: Review
    paymentMethod: String
    paidAmount: Float
    orderAmount: Float
    status: String
    orderStatus: String
    paymentStatus: String
    reason: String
    isActive: Boolean
    createdAt: String
    updatedAt: String
    deliveryCharges: Float
    tipping: Float
    taxationAmount: Float
    completionTime: Int
    orderDate: String
    expectedTime: String
    preparationTime: Int
    isPickedUp: Boolean
    acceptedAt: String
    pickedAt: String
    deliveredAt: String
    cancelledAt: String
    assignedAt: String
    isRinged: Boolean
    isRiderRinged: Boolean
    instructions: String
    discountAmount: Float
    eta: Eta
  }

  type RiderLocation {
    latitude: Float
    longitude: Float
    accuracy: Float
    heading: Float
    speed: Float
    recordedAt: String
  }

  type OrderTracking {
    orderId: String
    status: String
    riderLocation: RiderLocation
    eta: Eta
  }

  type Configuration {
    _id: ID
    currency: String
    currencySymbol: String
    deliveryRate: Float
    twilioEnabled: Boolean
    appAmplitudeApiKey: String
    customerAppSentryUrl: String
    termsAndConditions: String
    privacyPolicy: String
    skipMobileVerification: Boolean
    skipEmailVerification: Boolean
    costType: String
    publishableKey: String
    enableCustomerDemoMode: Boolean
    customerDemoZoneId: String
  }

  type Cuisine {
    _id: ID
    name: String
    description: String
    image: String
    shopType: String
  }

  type Tax {
    _id: ID
    taxationCharges: Float
    enabled: Boolean
  }

  type Tip {
    _id: ID
    tipVariations: [Float]
    enabled: Boolean
  }

  type Banner {
    _id: ID
    title: String
    description: String
    action: String
    screen: String
    file: String
    parameters: String
  }

  type ShopType {
    _id: ID
    image: String
    name: String
    slug: String
  }

  type ShopTypesResult {
    data: [ShopType]
  }

  type SubCategory {
    _id: ID
    title: String
    parentCategoryId: ID
  }

  type City {
    id: ID
    name: String
    latitude: Float
    longitude: Float
  }

  type CountryByIsoResult {
    cities: [City]
  }

  type SupportTicketUser {
    _id: ID
    name: String
    email: String
    phone: String
  }

  type SupportTicket {
    _id: ID
    title: String
    description: String
    status: String
    category: String
    orderId: String
    otherDetails: String
    createdAt: String
    updatedAt: String
    user: SupportTicketUser
  }

  type SingleUserSupportTicketsResult {
    tickets: [SupportTicket]
    docsCount: Int
    totalPages: Int
    currentPage: Int
  }

  type TicketMessageUser {
    _id: ID
    name: String
  }

  type TicketMessage {
    _id: ID
    content: String
    senderType: String
    isRead: Boolean
    createdAt: String
    updatedAt: String
    ticket: SupportTicket
  }

  type TicketMessagesResult {
    messages: [TicketMessage]
    ticket: TicketMessage
    page: Int
    totalPages: Int
    docsCount: Int
  }

  type ChatMessage {
    id: ID
    message: String
    image: String
    user: TicketMessageUser
    createdAt: String
  }

  type VersionInfo {
    android: String
    ios: String
  }

  type VersionsResult {
    customerAppVersion: VersionInfo
  }

  type AuthPayload {
    userId: ID
    token: String
    tokenExpiration: Int
    isActive: Boolean
    name: String
    email: String
    phone: String
    isNewUser: Boolean
  }

  type Result {
    result: String
  }

  type BooleanResult {
    result: Boolean
  }

  type Coupon {
    _id: ID
    discount: Float
    enabled: Boolean
    title: String
  }

  type CouponResult {
    coupon: Coupon
    message: String
    success: Boolean
  }

  type ChatSendResult {
    success: Boolean
    message: String
    data: ChatMessage
  }

  input AddressInput {
    id: ID
    _id: ID
    deliveryAddress: String
    details: String
    label: String
    location: LocationInput
    selected: Boolean
  }

  input LocationInput {
    coordinates: [Float]
  }

  input OrderInput {
    food: ID!
    variation: ID!
    addons: [OrderAddonInput]
    quantity: Int!
    specialInstructions: String
  }

  input OrderAddonInput {
    _id: ID!
    options: [ID!]!
  }

  input SingleUserSupportTicketsInput {
    page: Int
    limit: Int
  }

  input TicketMessagesInput {
    ticket: ID!
    page: Int
    limit: Int
  }

  input SupportTicketInput {
    title: String!
    description: String
    category: String
    orderId: String
    otherDetails: String
  }

  input MessageInput {
    ticket: ID!
    content: String!
    senderType: String
  }

  input ChatMessageInput {
    message: String
    image: String
  }

  type Query {
    users: [User]
    profile: User
    getReviewsByRestaurant(restaurant: ID!): ReviewData
    getSingleUserSupportTickets(input: SingleUserSupportTicketsInput!): SingleUserSupportTicketsResult
    getSingleSupportTicket(ticketId: ID!): SupportTicket
    getTicketMessages(input: TicketMessagesInput!): TicketMessagesResult
    getCountryByIso(iso: String!): CountryByIsoResult
    order(id: String!): Order
    orderTracking(id: ID!): OrderTracking
    orders(offset: Int): [Order]
    getUsersActiveOrders(page: Int!, limit: Int!, offset: Int!): [Order]
    getUsersPastOrders(page: Int!, limit: Int!, offset: Int!): [Order]
    configuration: Configuration
    nearByRestaurants(latitude: Float, longitude: Float, shopType: String): NearByRestaurantsResult
    nearByRestaurantsPreview(latitude: Float, longitude: Float, shopType: String, page: Int, limit: Int): NearByRestaurantsPreviewResult
    topRatedVendorsPreview(latitude: Float!, longitude: Float!): [RestaurantCarouselPreview]
    topRatedVendors(latitude: Float!, longitude: Float!): [Restaurant]
    restaurant(id: String): Restaurant
    getCuisines: [Cuisine]
    rider(id: String): Rider
    getTaxation: [Tax]
    getTipping: [Tip]
    userFavourite(latitude: Float, longitude: Float): [Restaurant]
    fetchCategoryDetailsByStoreIdForMobile(storeId: String!): [JSON]
    popularFoodItems(restaurantId: String!): [Food]
    chat(order: ID!): [ChatMessage]
    recentOrderRestaurantsPreview(latitude: Float!, longitude: Float!): [RestaurantCarouselPreview]
    recentOrderRestaurants(latitude: Float!, longitude: Float!): [Restaurant]
    mostOrderedRestaurantsPreview(latitude: Float!, longitude: Float!, shopType: String, page: Int, limit: Int): [RestaurantCarouselPreview]
    mostOrderedRestaurants(latitude: Float!, longitude: Float!): [Restaurant]
    relatedItems(itemId: String!, restaurantId: String!): [ID]
    popularItems(restaurantId: String!): [JSON]
    getBanners: [Banner]
    getZones: [Zone]
    getVersions: VersionsResult
    subCategories: [SubCategory]
    subCategoriesByParentId(parentCategoryId: String!): [SubCategory]
    fetchAllShopTypes: ShopTypesResult
    nearByRestaurantsCuisines(latitude: Float!, longitude: Float!, shopType: String!): [Restaurant]
  }

  type Mutation {
    uploadImageToS3(image: String!): UploadImageResult
    sendChatMessage(orderId: ID!, messageInput: ChatMessageInput!): ChatSendResult
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
    ): Order
    pushToken(token: String): User
    forgotPassword(email: String!): Result
    resetPassword(password: String!, email: String!, otp: String!): Result
    coupon(coupon: String!, restaurantId: ID!): CouponResult
    deleteAddress(id: ID!): User
    deleteBulkAddresses(ids: [ID!]!): User
    createAddress(addressInput: AddressInput!): User
    editAddress(addressInput: AddressInput!): User
    changePassword(oldPassword: String!, newPassword: String!): Result
    selectAddress(id: String!): User
    reviewOrder(reviewInput: ReviewInput!): Order
    addFavourite(id: String!): User
    emailExist(email: String!): Boolean
    phoneExist(phone: String!): Boolean
    sendOtpToEmail(email: String!): Result
    sendOtpToPhoneNumber(phone: String!): Result
    Deactivate(isActive: Boolean!, email: String!): User
    login(
      email: String
      password: String
      type: String!
      appleId: String
      appleNonce: String
      idToken: String
      name: String
      notificationToken: String
    ): AuthPayload
    createUser(userInput: CreateUserInput!): AuthPayload
    updateUser(updateUserInput: UpdateUserInput!): User
    updateNotificationStatus(offerNotification: Boolean!, orderNotification: Boolean!): User
    abortOrder(id: String!): Order
    createActivity(groupId: String!, module: String!, screenPath: String!, type: String!, details: String!): Boolean
    createSupportTicket(ticketInput: SupportTicketInput!): SupportTicket
    createMessage(messageInput: MessageInput!): TicketMessage
    verifyOtp(otp: String!, email: String, phone: String): Result
  }

  type UploadImageResult {
    imageUrl: String
  }

  input ReviewInput {
    order: String!
    rating: Int!
    description: String
  }

  input CreateUserInput {
    phone: String
    email: String
    password: String
    name: String
    notificationToken: String
    appleId: String
    emailIsVerified: Boolean
    isPhoneExists: Boolean
  }

  input UpdateUserInput {
    name: String!
    phone: String
    phoneIsVerified: Boolean
    emailIsVerified: Boolean
  }

  type Subscription {
    subscriptionOrder(id: String!): Order
    subscriptionOrderTracking(id: String!): OrderTracking
    subscriptionRiderLocation(riderId: String!): RiderLocation
    orderStatusChanged(userId: String!): OrderStatusChangedPayload
    subscriptionNewMessage(order: ID!): ChatMessage
  }

  type OrderStatusChangedPayload {
    userId: ID
    origin: String
    order: Order
  }
`;

module.exports = { typeDefs };

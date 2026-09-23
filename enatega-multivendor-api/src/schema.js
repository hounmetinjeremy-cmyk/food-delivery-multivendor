export const typeDefs = /* GraphQL */ `
  type User {
    id: ID!
    email: String!
    name: String!
    phone: String
    role: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Restaurant {
    id: ID!
    name: String!
    image: String
    address: String
    deliveryTime: Int
    minimumOrder: Float
    freeDelivery: Boolean
    acceptVouchers: Boolean
    isActive: Boolean
  }

  type RestaurantPreview {
    id: ID!
    name: String!
    image: String
    deliveryTime: Int
    minimumOrder: Float
    freeDelivery: Boolean
    acceptVouchers: Boolean
  }

  type NearByRestaurantsPreviewResult {
    restaurants: [RestaurantPreview!]!
  }

  type Variation {
    id: ID!
    title: String!
    price: Float!
  }

  type Food {
    id: ID!
    title: String!
    description: String
    image: String
    variations: [Variation!]!
  }

  type OrderItem {
    food: Food!
    variation: Variation
    quantity: Int!
    price: Float!
  }

  type Order {
    id: ID!
    status: String!
    orderAmount: Float!
    deliveryAddress: String
    paymentMethod: String
    createdAt: String!
    restaurant: Restaurant!
    items: [OrderItem!]!
  }

  input RestaurantInput {
    name: String!
    image: String
    address: String
    deliveryTime: Int
    minimumOrder: Float
    freeDelivery: Boolean
    acceptVouchers: Boolean
  }

  input OrderItemInput {
    foodId: ID!
    variationId: ID
    quantity: Int!
  }

  input OrderInput {
    restaurantId: ID!
    items: [OrderItemInput!]!
    deliveryAddress: String
    paymentMethod: String
  }

  type Query {
    me: User
    restaurants: [Restaurant!]!
    restaurant(id: ID!): Restaurant
    nearByRestaurantsPreview(latitude: Float, longitude: Float): NearByRestaurantsPreviewResult!
    myOrders: [Order!]!
  }

  type Mutation {
    register(email: String!, password: String!, name: String!, phone: String, role: String): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    createRestaurant(input: RestaurantInput!): Restaurant!
    editRestaurant(id: ID!, input: RestaurantInput!): Restaurant!
    placeOrder(input: OrderInput!): Order!
    updateOrderStatus(id: ID!, status: String!): Order!
  }

  # Diffusée en temps réel via WebSocket (GET /graphql avec Upgrade: websocket),
  # sur le protocole graphql-ws. Déclenchée par updateOrderStatus.
  type Subscription {
    orderStatusChanged(orderId: ID!): Order!
  }
`;

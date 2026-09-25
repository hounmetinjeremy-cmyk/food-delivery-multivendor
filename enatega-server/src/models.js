const mongoose = require('mongoose');
const { Schema } = mongoose;

const LocationSchema = new Schema(
  { type: { type: String, default: 'Point' }, coordinates: [Number] },
  { _id: false }
);

const AddressSchema = new Schema({
  deliveryAddress: String,
  details: String,
  label: String,
  location: LocationSchema,
  selected: { type: Boolean, default: false },
});

const OpeningTimeSchema = new Schema({ startTime: String, endTime: String }, { _id: false });
const OpeningHourSchema = new Schema(
  { day: String, times: [OpeningTimeSchema] },
  { _id: false }
);

const AddonOptionSchema = new Schema(
  { title: String, description: String, price: Number },
  { _id: true }
);

const AddonSchema = new Schema({
  options: [AddonOptionSchema],
  title: String,
  description: String,
  quantityMinimum: { type: Number, default: 0 },
  quantityMaximum: { type: Number, default: 1 },
});

const VariationSchema = new Schema({
  title: String,
  price: Number,
  discounted: Number,
  addons: [{ type: Schema.Types.ObjectId }],
  isOutOfStock: { type: Boolean, default: false },
});

const FoodSchema = new Schema({
  title: String,
  description: String,
  image: String,
  subCategory: String,
  isActive: { type: Boolean, default: true },
  isOutOfStock: { type: Boolean, default: false },
  variations: [VariationSchema],
}, { timestamps: true });

const CategorySchema = new Schema({
  title: String,
  foods: [FoodSchema],
}, { timestamps: true });

const RestaurantOptionSchema = new Schema(
  { title: String, description: String, price: Number },
  { _id: true }
);

const restaurantSchema = new Schema({
  orderId: { type: Number, default: 0 },
  orderPrefix: { type: String, default: 'ORD' },
  name: String,
  image: String,
  logo: String,
  address: String,
  location: LocationSchema,
  categories: [CategorySchema],
  options: [RestaurantOptionSchema],
  addons: [AddonSchema],
  zone: { type: Schema.Types.ObjectId, ref: 'Zone' },
  username: String,
  deliveryTime: { type: Number, default: 30 },
  minimumOrder: { type: Number, default: 0 },
  sections: [String],
  rating: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  isAvailable: { type: Boolean, default: true },
  openingTimes: [OpeningHourSchema],
  slug: String,
  stripeDetailsSubmitted: { type: Boolean, default: false },
  owner: { type: Schema.Types.ObjectId, ref: 'User' },
  deliveryBounds: { type: { type: String, default: 'Polygon' }, coordinates: [[[Number]]] },
  tax: { type: Number, default: 0 },
  notificationToken: String,
  enableNotification: { type: Boolean, default: true },
  shopType: { type: String, default: 'restaurant' },
  freeDelivery: { type: Boolean, default: false },
  acceptVouchers: { type: Boolean, default: false },
  cuisines: [String],
  tags: [String],
  phone: String,
  restaurantUrl: String,
}, { timestamps: true });

const userSchema = new Schema({
  name: String,
  phone: String,
  phoneIsVerified: { type: Boolean, default: false },
  email: { type: String, index: true },
  emailIsVerified: { type: Boolean, default: false },
  passwordHash: String,
  isActive: { type: Boolean, default: true },
  isOrderNotification: { type: Boolean, default: true },
  isOfferNotification: { type: Boolean, default: true },
  addresses: [AddressSchema],
  notificationToken: String,
  favourite: [{ type: Schema.Types.ObjectId, ref: 'Restaurant' }],
  userType: { type: String, default: 'CUSTOMER' },
  appleId: String,
  otp: String,
  otpExpiresAt: Date,
}, { timestamps: true });

const riderSchema = new Schema({
  name: String,
  email: String,
  username: String,
  phone: String,
  passwordHash: String,
  image: String,
  available: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  accountNumber: String,
  currentWalletAmount: { type: Number, default: 0 },
  totalWalletAmount: { type: Number, default: 0 },
  withdrawnWalletAmount: { type: Number, default: 0 },
  location: LocationSchema,
  zone: { type: Schema.Types.ObjectId, ref: 'Zone' },
}, { timestamps: true });

const reviewSchema = new Schema({
  order: { type: Schema.Types.ObjectId, ref: 'Order' },
  rating: Number,
  description: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const orderItemSchema = new Schema({
  title: String,
  food: String,
  description: String,
  image: String,
  quantity: Number,
  variation: {
    _id: Schema.Types.ObjectId,
    title: String,
    price: Number,
    discounted: Number,
  },
  addons: [AddonSchema],
  specialInstructions: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const orderSchema = new Schema({
  orderId: String,
  restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant' },
  deliveryAddress: {
    deliveryAddress: String,
    details: String,
    label: String,
    location: LocationSchema,
  },
  items: [orderItemSchema],
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  rider: { type: Schema.Types.ObjectId, ref: 'Rider', default: null },
  review: { type: Schema.Types.ObjectId, ref: 'Review', default: null },
  paymentMethod: String,
  paidAmount: { type: Number, default: 0 },
  orderAmount: { type: Number, default: 0 },
  status: { type: String, default: 'PENDING' },
  orderStatus: { type: String, default: 'PENDING' },
  paymentStatus: { type: String, default: 'PENDING' },
  reason: String,
  isActive: { type: Boolean, default: true },
  deliveryCharges: { type: Number, default: 0 },
  tipping: { type: Number, default: 0 },
  taxationAmount: { type: Number, default: 0 },
  completionTime: Number,
  orderDate: String,
  expectedTime: String,
  preparationTime: Number,
  isPickedUp: { type: Boolean, default: false },
  acceptedAt: Date,
  pickedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  assignedAt: Date,
  isRinged: { type: Boolean, default: false },
  isRiderRinged: { type: Boolean, default: false },
  instructions: String,
  discountAmount: { type: Number, default: 0 },
  couponCode: String,
}, { timestamps: true });

const zoneSchema = new Schema({
  title: String,
  tax: { type: Number, default: 0 },
  description: String,
  location: { type: { type: String, default: 'Polygon' }, coordinates: [[[Number]]] },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const configurationSchema = new Schema({
  currency: { type: String, default: 'USD' },
  currencySymbol: { type: String, default: '$' },
  deliveryRate: { type: Number, default: 0 },
  twilioEnabled: { type: Boolean, default: false },
  appAmplitudeApiKey: String,
  customerAppSentryUrl: String,
  termsAndConditions: String,
  privacyPolicy: String,
  skipMobileVerification: { type: Boolean, default: true },
  skipEmailVerification: { type: Boolean, default: true },
  costType: { type: String, default: 'fixed' },
  publishableKey: String,
  enableCustomerDemoMode: { type: Boolean, default: false },
  customerDemoZoneId: String,
});

const supportTicketSchema = new Schema({
  title: String,
  description: String,
  status: { type: String, default: 'OPEN' },
  category: String,
  orderId: String,
  otherDetails: String,
  user: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const ticketMessageSchema = new Schema({
  content: String,
  senderType: String,
  isRead: { type: Boolean, default: false },
  ticket: { type: Schema.Types.ObjectId, ref: 'SupportTicket' },
}, { timestamps: true });

const orderChatMessageSchema = new Schema({
  order: { type: Schema.Types.ObjectId, ref: 'Order' },
  message: String,
  image: String,
  user: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = {
  OrderChatMessage: mongoose.model('OrderChatMessage', orderChatMessageSchema),
  User: mongoose.model('User', userSchema),
  Restaurant: mongoose.model('Restaurant', restaurantSchema),
  Rider: mongoose.model('Rider', riderSchema),
  Review: mongoose.model('Review', reviewSchema),
  Order: mongoose.model('Order', orderSchema),
  Zone: mongoose.model('Zone', zoneSchema),
  Configuration: mongoose.model('Configuration', configurationSchema),
  SupportTicket: mongoose.model('SupportTicket', supportTicketSchema),
  TicketMessage: mongoose.model('TicketMessage', ticketMessageSchema),
};

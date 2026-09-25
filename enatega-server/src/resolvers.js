const {
  User,
  Restaurant,
  Rider,
  Review,
  Order,
  Zone,
  Configuration,
  SupportTicket,
  TicketMessage,
  OrderChatMessage,
} = require('./models');
const { signToken, hashPassword, comparePassword } = require('./auth');
const { pubsub, EVENTS } = require('./pubsub');

const DEV_OTP = '123456'; // Code de test fixe : aucun SMS/email n'est réellement envoyé (voir README).

function requireAuth(context) {
  if (!context.userId) throw new Error('Non authentifié');
  return context.userId;
}

function iso(date) {
  return date ? new Date(date).toISOString() : null;
}

// Construit un objet Order au format attendu par le schéma GraphQL (dates en ISO).
async function toOrder(orderDoc) {
  if (!orderDoc) return null;
  const o = orderDoc.toObject ? orderDoc.toObject() : orderDoc;
  return {
    ...o,
    _id: o._id,
    id: o._id,
    createdAt: iso(o.createdAt),
    updatedAt: iso(o.updatedAt),
    acceptedAt: iso(o.acceptedAt),
    pickedAt: iso(o.pickedAt),
    deliveredAt: iso(o.deliveredAt),
    cancelledAt: iso(o.cancelledAt),
    assignedAt: iso(o.assignedAt),
    restaurant: o.restaurant && o.restaurant._id ? o.restaurant : o.restaurant,
    items: (o.items || []).map((it) => ({ ...it, id: it._id })),
    eta: null,
  };
}

async function populatedOrder(id) {
  const doc = await Order.findById(id).populate('restaurant').populate('user').populate('rider').populate('review');
  return toOrder(doc);
}

async function findFoodAndVariation(restaurantDoc, foodId, variationId) {
  for (const category of restaurantDoc.categories) {
    for (const food of category.foods) {
      if (String(food._id) === String(foodId)) {
        const variation = food.variations.id(variationId);
        if (variation) return { food, variation };
      }
    }
  }
  return { food: null, variation: null };
}

function findAddonsOnRestaurant(restaurantDoc, addonInputs) {
  if (!addonInputs || !addonInputs.length) return [];
  return addonInputs
    .map((a) => {
      const addon = restaurantDoc.addons.id(a._id);
      if (!addon) return null;
      const options = (addon.options || []).filter((opt) => a.options.includes(String(opt._id)));
      return {
        _id: addon._id,
        title: addon.title,
        description: addon.description,
        quantityMinimum: addon.quantityMinimum,
        quantityMaximum: addon.quantityMaximum,
        options: options.map((opt) => ({ _id: opt._id, title: opt.title, description: opt.description, price: opt.price })),
      };
    })
    .filter(Boolean);
}

const resolvers = {
  JSON: {
    // Scalaire JSON minimal : accepte n'importe quelle valeur JS sérialisable.
    __serialize: (value) => value,
    __parseValue: (value) => value,
    __parseLiteral: (ast) => ast.value,
  },

  Query: {
    users: async (_p, _a, context) => {
      if (!context.userId) return [];
      const me = await User.findById(context.userId);
      return me ? [me] : [];
    },

    profile: async (_p, _a, context) => {
      requireAuth(context);
      return User.findById(context.userId);
    },

    getReviewsByRestaurant: async (_p, { restaurant }) => {
      const orderIds = await Order.find({ restaurant }).distinct('_id');
      const reviews = await Review.find({ order: { $in: orderIds }, isActive: true }).populate({
        path: 'order',
        populate: ['restaurant', 'user', 'rider'],
      });
      const ratings = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
      return {
        reviews: await Promise.all(reviews.map(async (r) => ({ ...r.toObject(), order: await toOrder(r.order) }))),
        ratings,
        total: reviews.length,
      };
    },

    getSingleUserSupportTickets: async (_p, { input }, context) => {
      requireAuth(context);
      const page = input.page || 1;
      const limit = input.limit || 10;
      const filter = { user: context.userId };
      const [tickets, docsCount] = await Promise.all([
        SupportTicket.find(filter).populate('user').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        SupportTicket.countDocuments(filter),
      ]);
      return { tickets, docsCount, totalPages: Math.ceil(docsCount / limit) || 1, currentPage: page };
    },

    getSingleSupportTicket: async (_p, { ticketId }) => SupportTicket.findById(ticketId).populate('user'),

    getTicketMessages: async (_p, { input }) => {
      const page = input.page || 1;
      const limit = input.limit || 20;
      const filter = { ticket: input.ticket };
      const [messages, docsCount, ticket] = await Promise.all([
        TicketMessage.find(filter).sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit),
        TicketMessage.countDocuments(filter),
        SupportTicket.findById(input.ticket).populate('user'),
      ]);
      return { messages, ticket, page, totalPages: Math.ceil(docsCount / limit) || 1, docsCount };
    },

    getCountryByIso: async () => ({ cities: [] }),

    order: async (_p, { id }) => populatedOrder(id),

    orderTracking: async (_p, { id }) => {
      const order = await Order.findById(id).populate('rider');
      if (!order) return null;
      return {
        orderId: order.orderId,
        status: order.orderStatus,
        riderLocation: order.rider && order.rider.location
          ? {
              latitude: order.rider.location.coordinates[1],
              longitude: order.rider.location.coordinates[0],
              accuracy: null,
              heading: null,
              speed: null,
              recordedAt: iso(order.updatedAt),
            }
          : null,
        eta: null,
      };
    },

    orders: async (_p, { offset }, context) => {
      requireAuth(context);
      const docs = await Order.find({ user: context.userId })
        .populate('restaurant').populate('user').populate('rider').populate('review')
        .sort({ createdAt: -1 })
        .skip(offset || 0);
      return Promise.all(docs.map(toOrder));
    },

    getUsersActiveOrders: async (_p, { page, limit, offset }, context) => {
      requireAuth(context);
      const activeStatuses = ['PENDING', 'ACCEPTED', 'ASSIGNED', 'PICKED'];
      const docs = await Order.find({ user: context.userId, orderStatus: { $in: activeStatuses } })
        .populate('restaurant').populate('user').populate('rider').populate('review')
        .sort({ createdAt: -1 })
        .skip(offset || (page - 1) * limit || 0)
        .limit(limit || 10);
      return Promise.all(docs.map(toOrder));
    },

    getUsersPastOrders: async (_p, { page, limit, offset }, context) => {
      requireAuth(context);
      const doneStatuses = ['DELIVERED', 'CANCELLED', 'COMPLETED'];
      const docs = await Order.find({ user: context.userId, orderStatus: { $in: doneStatuses } })
        .populate('restaurant').populate('user').populate('rider').populate('review')
        .sort({ createdAt: -1 })
        .skip(offset || (page - 1) * limit || 0)
        .limit(limit || 10);
      return Promise.all(docs.map(toOrder));
    },

    configuration: async () => {
      let config = await Configuration.findOne();
      if (!config) config = await Configuration.create({});
      return config;
    },

    nearByRestaurants: async () => {
      const restaurants = await Restaurant.find({ isActive: true }).populate('zone').populate('owner');
      return { offers: [], sections: [], restaurants };
    },

    nearByRestaurantsPreview: async () => {
      const restaurants = await Restaurant.find({ isActive: true }).populate('zone').populate('owner');
      return { offers: [], sections: [], restaurants };
    },

    topRatedVendorsPreview: async () => Restaurant.find({ isActive: true }).sort({ rating: -1 }).limit(10),
    topRatedVendors: async () => Restaurant.find({ isActive: true }).sort({ rating: -1 }).limit(10).populate('zone').populate('owner'),
    recentOrderRestaurantsPreview: async () => Restaurant.find({ isActive: true }).limit(10),
    recentOrderRestaurants: async () => Restaurant.find({ isActive: true }).limit(10).populate('zone').populate('owner'),
    mostOrderedRestaurantsPreview: async () => Restaurant.find({ isActive: true }).limit(10),
    mostOrderedRestaurants: async () => Restaurant.find({ isActive: true }).limit(10).populate('zone').populate('owner'),
    nearByRestaurantsCuisines: async () => [],

    restaurant: async (_p, { id }) => Restaurant.findById(id).populate('zone').populate('owner'),

    getCuisines: async () => {
      const cuisines = await Restaurant.distinct('cuisines');
      return cuisines.filter(Boolean).map((name, i) => ({ _id: String(i), name, description: '', image: '', shopType: 'restaurant' }));
    },

    rider: async (_p, { id }) => Rider.findById(id),

    getTaxation: async () => [{ _id: 'default', taxationCharges: 0, enabled: false }],
    getTipping: async () => [{ _id: 'default', tipVariations: [0, 1, 2, 5], enabled: true }],

    userFavourite: async (_p, _a, context) => {
      requireAuth(context);
      const user = await User.findById(context.userId).populate('favourite');
      return user ? user.favourite : [];
    },

    fetchCategoryDetailsByStoreIdForMobile: async () => [],

    popularFoodItems: async (_p, { restaurantId }) => {
      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant) return [];
      const foods = [];
      for (const cat of restaurant.categories) {
        for (const food of cat.foods) {
          foods.push(food);
          if (foods.length >= 10) return foods;
        }
      }
      return foods;
    },

    chat: async (_p, { order }) => {
      const messages = await OrderChatMessage.find({ order }).populate('user').sort({ createdAt: 1 });
      return messages.map((m) => ({ id: m._id, message: m.message, image: m.image, user: m.user, createdAt: iso(m.createdAt) }));
    },

    popularItems: async () => [],
    relatedItems: async () => [],

    getBanners: async () => [],
    getZones: async () => Zone.find({ isActive: true }),
    getVersions: async () => ({ customerAppVersion: { android: '1.0.0', ios: '1.0.0' } }),
    subCategories: async () => [],
    subCategoriesByParentId: async () => [],
    fetchAllShopTypes: async () => ({
      data: [{ _id: 'restaurant', image: '', name: 'Restaurant', slug: 'restaurant' }],
    }),
  },

  Mutation: {
    uploadImageToS3: async (_p, { image }) => {
      // Stub MVP : l'image (base64) est renvoyée telle quelle en data URI.
      // À remplacer par un vrai stockage (ex: le bucket R2 déjà utilisé par le Worker Cloudflare) pour la production.
      const imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
      return { imageUrl };
    },

    sendChatMessage: async (_p, { orderId, messageInput }, context) => {
      requireAuth(context);
      const msg = await OrderChatMessage.create({
        order: orderId,
        message: messageInput.message,
        image: messageInput.image,
        user: context.userId,
      });
      const populated = await msg.populate('user');
      const payload = { id: populated._id, message: populated.message, image: populated.image, user: populated.user, createdAt: iso(populated.createdAt) };
      pubsub.publish(EVENTS.NEW_CHAT_MESSAGE(orderId), { subscriptionNewMessage: payload });
      return { success: true, message: 'ok', data: payload };
    },

    placeOrder: async (_p, args, context) => {
      const userId = requireAuth(context);
      const restaurantDoc = await Restaurant.findById(args.restaurant);
      if (!restaurantDoc) throw new Error('Restaurant introuvable');

      let orderAmount = 0;
      const items = [];
      for (const line of args.orderInput) {
        const { food, variation } = await findFoodAndVariation(restaurantDoc, line.food, line.variation);
        if (!food || !variation) throw new Error('Produit ou variation introuvable');
        const addons = findAddonsOnRestaurant(restaurantDoc, line.addons);
        const addonsTotal = addons.reduce(
          (sum, a) => sum + a.options.reduce((s, o) => s + (o.price || 0), 0),
          0
        );
        const unitPrice = (variation.discounted || variation.price || 0) + addonsTotal;
        orderAmount += unitPrice * line.quantity;

        items.push({
          title: food.title,
          food: food.title,
          description: food.description,
          image: food.image,
          quantity: line.quantity,
          variation: { _id: variation._id, title: variation.title, price: variation.price, discounted: variation.discounted },
          addons,
          specialInstructions: line.specialInstructions,
          isActive: true,
        });
      }

      orderAmount += args.deliveryCharges + args.taxationAmount + args.tipping;

      restaurantDoc.orderId = (restaurantDoc.orderId || 0) + 1;
      await restaurantDoc.save();

      const order = await Order.create({
        orderId: `${restaurantDoc.orderPrefix || 'ORD'}-${restaurantDoc.orderId}`,
        restaurant: restaurantDoc._id,
        deliveryAddress: {
          deliveryAddress: args.address.deliveryAddress,
          details: args.address.details,
          label: args.address.label,
          location: args.address.location,
        },
        items,
        user: userId,
        paymentMethod: args.paymentMethod,
        orderAmount,
        paidAmount: args.paymentMethod === 'COD' ? 0 : orderAmount,
        status: 'PENDING',
        orderStatus: 'PENDING',
        paymentStatus: args.paymentMethod === 'COD' ? 'PENDING' : 'PAID',
        deliveryCharges: args.deliveryCharges,
        tipping: args.tipping,
        taxationAmount: args.taxationAmount,
        orderDate: args.orderDate,
        isPickedUp: args.isPickedUp,
        instructions: args.instructions,
        discountAmount: 0,
        couponCode: args.couponCode,
      });

      const full = await populatedOrder(order._id);
      pubsub.publish(EVENTS.ORDER_UPDATED(String(order._id)), { subscriptionOrder: full });
      pubsub.publish(EVENTS.ORDER_STATUS_CHANGED_FOR_USER(String(userId)), {
        orderStatusChanged: { userId, origin: 'placeOrder', order: full },
      });
      return full;
    },

    pushToken: async (_p, { token }, context) => {
      requireAuth(context);
      return User.findByIdAndUpdate(context.userId, { notificationToken: token }, { new: true });
    },

    forgotPassword: async (_p, { email }) => {
      await User.findOneAndUpdate({ email }, { otp: DEV_OTP, otpExpiresAt: new Date(Date.now() + 15 * 60 * 1000) });
      return { result: 'ok' };
    },

    resetPassword: async (_p, { password, email, otp }) => {
      const user = await User.findOne({ email });
      if (!user || (user.otp !== otp && otp !== DEV_OTP)) throw new Error('Code invalide');
      user.passwordHash = await hashPassword(password);
      user.otp = null;
      await user.save();
      return { result: 'ok' };
    },

    coupon: async () => ({ coupon: null, message: 'Code promo invalide', success: false }),

    deleteAddress: async (_p, { id }, context) => {
      requireAuth(context);
      const user = await User.findById(context.userId);
      user.addresses = user.addresses.filter((a) => String(a._id) !== String(id));
      await user.save();
      return user;
    },

    deleteBulkAddresses: async (_p, { ids }, context) => {
      requireAuth(context);
      const user = await User.findById(context.userId);
      user.addresses = user.addresses.filter((a) => !ids.includes(String(a._id)));
      await user.save();
      return user;
    },

    createAddress: async (_p, { addressInput }, context) => {
      requireAuth(context);
      const user = await User.findById(context.userId);
      user.addresses.push(addressInput);
      await user.save();
      return user;
    },

    editAddress: async (_p, { addressInput }, context) => {
      requireAuth(context);
      const user = await User.findById(context.userId);
      const addr = user.addresses.id(addressInput._id || addressInput.id);
      if (addr) Object.assign(addr, addressInput);
      await user.save();
      return user;
    },

    changePassword: async (_p, { oldPassword, newPassword }, context) => {
      requireAuth(context);
      const user = await User.findById(context.userId);
      const valid = await comparePassword(oldPassword, user.passwordHash);
      if (!valid) throw new Error('Ancien mot de passe incorrect');
      user.passwordHash = await hashPassword(newPassword);
      await user.save();
      return { result: 'ok' };
    },

    selectAddress: async (_p, { id }, context) => {
      requireAuth(context);
      const user = await User.findById(context.userId);
      user.addresses.forEach((a) => {
        a.selected = String(a._id) === String(id);
      });
      await user.save();
      return user;
    },

    reviewOrder: async (_p, { reviewInput }, context) => {
      requireAuth(context);
      const review = await Review.create({
        order: reviewInput.order,
        rating: reviewInput.rating,
        description: reviewInput.description,
      });
      await Order.findByIdAndUpdate(reviewInput.order, { review: review._id });
      return populatedOrder(reviewInput.order);
    },

    addFavourite: async (_p, { id }, context) => {
      requireAuth(context);
      const user = await User.findById(context.userId);
      const idx = user.favourite.findIndex((f) => String(f) === String(id));
      if (idx >= 0) user.favourite.splice(idx, 1);
      else user.favourite.push(id);
      await user.save();
      return user;
    },

    emailExist: async (_p, { email }) => !!(await User.exists({ email })),
    phoneExist: async (_p, { phone }) => !!(await User.exists({ phone })),

    sendOtpToEmail: async (_p, { email }) => {
      await User.findOneAndUpdate({ email }, { otp: DEV_OTP }, { upsert: false });
      return { result: 'ok' };
    },

    sendOtpToPhoneNumber: async (_p, { phone }) => {
      await User.findOneAndUpdate({ phone }, { otp: DEV_OTP }, { upsert: false });
      return { result: 'ok' };
    },

    Deactivate: async (_p, { isActive, email }) => {
      const user = await User.findOneAndUpdate({ email }, { isActive }, { new: true });
      return user;
    },

    login: async (_p, args) => {
      let user;
      if (args.type === 'apple') {
        user = await User.findOne({ appleId: args.appleId });
        if (!user) {
          user = await User.create({ appleId: args.appleId, name: args.name, notificationToken: args.notificationToken });
        }
      } else {
        user = await User.findOne({ email: args.email });
        if (!user) throw new Error('Identifiants invalides');
        const valid = await comparePassword(args.password, user.passwordHash);
        if (!valid) throw new Error('Identifiants invalides');
      }
      if (args.notificationToken) {
        user.notificationToken = args.notificationToken;
        await user.save();
      }
      const token = signToken(user._id);
      return {
        userId: user._id,
        token,
        tokenExpiration: 30 * 24 * 60 * 60,
        isActive: user.isActive,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isNewUser: false,
      };
    },

    createUser: async (_p, { userInput }) => {
      const existing = await User.findOne({ email: userInput.email });
      if (existing) throw new Error('Cet email est déjà utilisé');
      const passwordHash = userInput.password ? await hashPassword(userInput.password) : undefined;
      const user = await User.create({
        phone: userInput.phone,
        email: userInput.email,
        passwordHash,
        name: userInput.name,
        notificationToken: userInput.notificationToken,
        appleId: userInput.appleId,
        emailIsVerified: userInput.emailIsVerified ?? true,
      });
      const token = signToken(user._id);
      return {
        userId: user._id,
        token,
        tokenExpiration: 30 * 24 * 60 * 60,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isActive: user.isActive,
        isNewUser: true,
      };
    },

    updateUser: async (_p, { updateUserInput }, context) => {
      requireAuth(context);
      return User.findByIdAndUpdate(context.userId, updateUserInput, { new: true });
    },

    updateNotificationStatus: async (_p, { offerNotification, orderNotification }, context) => {
      requireAuth(context);
      return User.findByIdAndUpdate(
        context.userId,
        { isOfferNotification: offerNotification, isOrderNotification: orderNotification },
        { new: true }
      );
    },

    abortOrder: async (_p, { id }, context) => {
      requireAuth(context);
      const order = await Order.findByIdAndUpdate(
        id,
        { orderStatus: 'CANCELLED', status: 'CANCELLED', cancelledAt: new Date() },
        { new: true }
      );
      const full = await populatedOrder(order._id);
      pubsub.publish(EVENTS.ORDER_UPDATED(String(order._id)), { subscriptionOrder: full });
      return full;
    },

    createActivity: async () => true,

    createSupportTicket: async (_p, { ticketInput }, context) => {
      requireAuth(context);
      const ticket = await SupportTicket.create({ ...ticketInput, user: context.userId });
      return ticket.populate('user');
    },

    createMessage: async (_p, { messageInput }) => {
      const msg = await TicketMessage.create({
        ticket: messageInput.ticket,
        content: messageInput.content,
        senderType: messageInput.senderType || 'CUSTOMER',
      });
      return msg;
    },

    verifyOtp: async (_p, { otp, email, phone }) => {
      const query = email ? { email } : { phone };
      const user = await User.findOne(query);
      if (!user) throw new Error('Utilisateur introuvable');
      if (otp !== DEV_OTP && user.otp !== otp) throw new Error('Code invalide');
      if (email) user.emailIsVerified = true;
      if (phone) user.phoneIsVerified = true;
      user.otp = null;
      await user.save();
      return { result: 'ok' };
    },
  },

  Subscription: {
    subscriptionOrder: {
      subscribe: (_p, { id }) => pubsub.asyncIterator(EVENTS.ORDER_UPDATED(id)),
    },
    subscriptionOrderTracking: {
      subscribe: (_p, { id }) => pubsub.asyncIterator(EVENTS.ORDER_TRACKING_UPDATED(id)),
    },
    subscriptionRiderLocation: {
      subscribe: (_p, { riderId }) => pubsub.asyncIterator(EVENTS.RIDER_LOCATION_UPDATED(riderId)),
    },
    orderStatusChanged: {
      subscribe: (_p, { userId }) => pubsub.asyncIterator(EVENTS.ORDER_STATUS_CHANGED_FOR_USER(userId)),
    },
    subscriptionNewMessage: {
      subscribe: (_p, { order }) => pubsub.asyncIterator(EVENTS.NEW_CHAT_MESSAGE(order)),
    },
  },
};

module.exports = { resolvers };

import { signJWT, hashPassword, verifyPassword } from './auth.js';

function toRestaurant(row) {
  return {
    id: row.id,
    name: row.name,
    image: row.image,
    address: row.address,
    deliveryTime: row.delivery_time,
    minimumOrder: row.minimum_order,
    freeDelivery: !!row.free_delivery,
    acceptVouchers: !!row.accept_vouchers,
    isActive: !!row.is_active,
  };
}

function requireAuth(context) {
  if (!context.user) {
    throw new Error('Non authentifié');
  }
  return context.user;
}

export const resolvers = {
  Query: {
    me: (_parent, _args, context) => context.user || null,

    restaurants: async (_parent, _args, context) => {
      const { results } = await context.env.DB.prepare(
        'SELECT * FROM restaurants WHERE is_active = 1 ORDER BY created_at DESC'
      ).all();
      return results.map(toRestaurant);
    },

    restaurant: async (_parent, { id }, context) => {
      const row = await context.env.DB.prepare('SELECT * FROM restaurants WHERE id = ?').bind(id).first();
      return row ? toRestaurant(row) : null;
    },

    // Mirrors the existing frontend's nearByRestaurantsPreview query shape.
    // Distance/geo filtering can be added later; for now returns active restaurants.
    nearByRestaurantsPreview: async (_parent, _args, context) => {
      const { results } = await context.env.DB.prepare(
        'SELECT * FROM restaurants WHERE is_active = 1 ORDER BY created_at DESC LIMIT 50'
      ).all();
      return {
        restaurants: results.map((row) => ({
          id: row.id,
          name: row.name,
          image: row.image,
          deliveryTime: row.delivery_time,
          minimumOrder: row.minimum_order,
          freeDelivery: !!row.free_delivery,
          acceptVouchers: !!row.accept_vouchers,
        })),
      };
    },

    myOrders: async (_parent, _args, context) => {
      const user = requireAuth(context);
      const { results } = await context.env.DB.prepare(
        'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC'
      )
        .bind(user.id)
        .all();
      return results.map((row) => ({
        id: row.id,
        status: row.status,
        orderAmount: row.order_amount,
        deliveryAddress: row.delivery_address,
        paymentMethod: row.payment_method,
        createdAt: row.created_at,
        restaurant: { id: row.restaurant_id },
        items: [],
      }));
    },
  },

  Mutation: {
    register: async (_parent, { email, password, name, phone, role }, context) => {
      const existing = await context.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
      if (existing) throw new Error('Cet email est déjà utilisé');

      const id = crypto.randomUUID();
      const passwordHash = await hashPassword(password);
      const userRole = role || 'CUSTOMER';

      await context.env.DB.prepare(
        'INSERT INTO users (id, email, password_hash, name, phone, role) VALUES (?, ?, ?, ?, ?, ?)'
      )
        .bind(id, email, passwordHash, name, phone || null, userRole)
        .run();

      const user = { id, email, name, phone, role: userRole };
      const token = await signJWT({ id, role: userRole }, context.env.JWT_SECRET);
      return { token, user };
    },

    login: async (_parent, { email, password }, context) => {
      const row = await context.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
      if (!row) throw new Error('Identifiants invalides');

      const valid = await verifyPassword(password, row.password_hash);
      if (!valid) throw new Error('Identifiants invalides');

      const user = { id: row.id, email: row.email, name: row.name, phone: row.phone, role: row.role };
      const token = await signJWT({ id: row.id, role: row.role }, context.env.JWT_SECRET);
      return { token, user };
    },

    createRestaurant: async (_parent, { input }, context) => {
      const user = requireAuth(context);
      if (user.role !== 'VENDOR' && user.role !== 'ADMIN') {
        throw new Error('Seul un vendeur peut créer un restaurant');
      }

      const id = crypto.randomUUID();
      await context.env.DB.prepare(
        `INSERT INTO restaurants
         (id, owner_id, name, image, address, delivery_time, minimum_order, free_delivery, accept_vouchers)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          id,
          user.id,
          input.name,
          input.image || null,
          input.address || null,
          input.deliveryTime ?? 30,
          input.minimumOrder ?? 0,
          input.freeDelivery ? 1 : 0,
          input.acceptVouchers ? 1 : 0
        )
        .run();

      const row = await context.env.DB.prepare('SELECT * FROM restaurants WHERE id = ?').bind(id).first();
      return toRestaurant(row);
    },

    editRestaurant: async (_parent, { id, input }, context) => {
      const user = requireAuth(context);
      const existing = await context.env.DB.prepare('SELECT * FROM restaurants WHERE id = ?').bind(id).first();
      if (!existing) throw new Error('Restaurant introuvable');
      if (existing.owner_id !== user.id && user.role !== 'ADMIN') {
        throw new Error("Vous n'êtes pas autorisé à modifier ce restaurant");
      }

      await context.env.DB.prepare(
        `UPDATE restaurants SET
           name = ?, image = ?, address = ?, delivery_time = ?, minimum_order = ?,
           free_delivery = ?, accept_vouchers = ?
         WHERE id = ?`
      )
        .bind(
          input.name ?? existing.name,
          input.image ?? existing.image,
          input.address ?? existing.address,
          input.deliveryTime ?? existing.delivery_time,
          input.minimumOrder ?? existing.minimum_order,
          input.freeDelivery ? 1 : 0,
          input.acceptVouchers ? 1 : 0,
          id
        )
        .run();

      const row = await context.env.DB.prepare('SELECT * FROM restaurants WHERE id = ?').bind(id).first();
      return toRestaurant(row);
    },

    placeOrder: async (_parent, { input }, context) => {
      const user = requireAuth(context);
      const orderId = crypto.randomUUID();

      let total = 0;
      const itemRows = [];
      for (const item of input.items) {
        const food = await context.env.DB.prepare('SELECT * FROM foods WHERE id = ?').bind(item.foodId).first();
        if (!food) throw new Error(`Produit introuvable: ${item.foodId}`);

        let price = 0;
        if (item.variationId) {
          const variation = await context.env.DB.prepare('SELECT * FROM variations WHERE id = ?')
            .bind(item.variationId)
            .first();
          price = variation ? variation.price : 0;
        }
        total += price * item.quantity;
        itemRows.push({ id: crypto.randomUUID(), foodId: item.foodId, variationId: item.variationId, quantity: item.quantity, price });
      }

      await context.env.DB.prepare(
        `INSERT INTO orders (id, customer_id, restaurant_id, order_amount, delivery_address, payment_method)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(orderId, user.id, input.restaurantId, total, input.deliveryAddress || null, input.paymentMethod || 'COD')
        .run();

      for (const item of itemRows) {
        await context.env.DB.prepare(
          `INSERT INTO order_items (id, order_id, food_id, variation_id, quantity, price)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
          .bind(item.id, orderId, item.foodId, item.variationId || null, item.quantity, item.price)
          .run();
      }

      const row = await context.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
      return {
        id: row.id,
        status: row.status,
        orderAmount: row.order_amount,
        deliveryAddress: row.delivery_address,
        paymentMethod: row.payment_method,
        createdAt: row.created_at,
        restaurant: { id: row.restaurant_id },
        items: [],
      };
    },

    updateOrderStatus: async (_parent, { id, status }, context) => {
      const user = requireAuth(context);
      if (!['VENDOR', 'RIDER', 'ADMIN'].includes(user.role)) {
        throw new Error("Vous n'êtes pas autorisé à modifier le statut d'une commande");
      }

      await context.env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, id).run();
      const row = await context.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
      return {
        id: row.id,
        status: row.status,
        orderAmount: row.order_amount,
        deliveryAddress: row.delivery_address,
        paymentMethod: row.payment_method,
        createdAt: row.created_at,
        restaurant: { id: row.restaurant_id },
        items: [],
      };
    },
  },
};

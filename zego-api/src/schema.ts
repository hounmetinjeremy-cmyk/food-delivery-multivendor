import { createSchema } from 'graphql-yoga'
import { signJWT, verifyJWT, verifyPassword } from './auth'
import { verifyGoogleIdToken } from './google'
import { AuthError, requireUser, requireRole, type GraphQLContext } from './context'
import { catalogTypeDefs, catalogResolvers } from './catalog'
import { orderTypeDefs, orderResolvers } from './orders'

function newId(): string {
  return crypto.randomUUID()
}

interface UserRow {
  id: string
  name: string
  email: string | null
  role: string
  image_url: string | null
  is_active?: number
  password_hash?: string | null
}

/** Shared by continueWithGoogle and login(type: "google") — verifies the
 * Google ID token and finds-or-creates the matching customer user. */
async function upsertGoogleUser(
  idToken: string,
  ctx: GraphQLContext
): Promise<UserRow> {
  if (!ctx.env.GOOGLE_CLIENT_IDS) {
    throw new Error('Google Sign-In is not configured on this server')
  }
  const payload = await verifyGoogleIdToken(idToken, ctx.env.GOOGLE_CLIENT_IDS)
  const email = payload.email!.toLowerCase()

  let user = await ctx.env.DB.prepare(
    'SELECT id, name, email, role, image_url FROM users WHERE google_id = ?'
  )
    .bind(payload.sub)
    .first<UserRow>()

  if (!user) {
    const existingByEmail = await ctx.env.DB.prepare(
      'SELECT id, name, email, role, image_url FROM users WHERE email = ?'
    )
      .bind(email)
      .first<UserRow>()

    if (existingByEmail) {
      await ctx.env.DB.prepare('UPDATE users SET google_id = ? WHERE id = ?')
        .bind(payload.sub, existingByEmail.id)
        .run()
      user = existingByEmail
    } else {
      const userId = newId()
      const name = payload.name || email.split('@')[0]
      await ctx.env.DB.prepare(
        `INSERT INTO users (id, email, role, name, google_id, image_url)
         VALUES (?, ?, 'customer', ?, ?, ?)`
      )
        .bind(userId, email, name, payload.sub, payload.picture ?? null)
        .run()
      user = {
        id: userId,
        name,
        email,
        role: 'customer',
        image_url: payload.picture ?? null
      }
    }
  }
  return user
}

/** Shared by ownerLogin and ownerSession — signs fresh tokens and loads the
 * vendor/admin's restaurants into the shape the admin app's Apollo queries expect. */
async function buildOwnerSessionPayload(user: UserRow, ctx: GraphQLContext) {
  const token = await signJWT(
    { sub: user.id, role: user.role as 'vendor' },
    ctx.env.JWT_SECRET
  )
  const refreshToken = await signJWT(
    { sub: user.id, role: user.role as 'vendor', kind: 'refresh' },
    ctx.env.JWT_SECRET,
    90 * 24 * 60 * 60
  )
  const restaurants = await ctx.env.DB.prepare(
    'SELECT id, name, image FROM restaurants WHERE owner_id = ?'
  )
    .bind(user.id)
    .all<{ id: string; name: string; image: string | null }>()
  const inThirtyDays = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString()
  const inNinetyDays = new Date(
    Date.now() + 90 * 24 * 60 * 60 * 1000
  ).toISOString()
  return {
    userId: user.id,
    token,
    tokenExpiration: inThirtyDays,
    refreshToken,
    refreshTokenExpiration: inNinetyDays,
    email: user.email,
    userType: user.role.toUpperCase(),
    restaurants: restaurants.results.map((r) => ({
      id: r.id,
      _id: r.id,
      orderId: r.id,
      name: r.name,
      image: r.image,
      address: null
    })),
    permissions: [],
    userTypeId: user.id,
    image: user.image_url,
    name: user.name,
    isActive: user.is_active !== 0
  }
}

export const schema = createSchema<GraphQLContext>({
  typeDefs: [
    /* GraphQL */ `
    type Query {
      health: String!
      configuration: Configuration!
      availableRiders: [Rider!]!
      myConversations: [Conversation!]!
      messages(conversationId: ID!): [Message!]!
      ownerSession: OwnerLoginPayload!
      adminSsoToken: String!
      riderSsoToken: RiderSsoPayload!
    }

    type RiderSsoPayload {
      userId: ID!
      token: String!
    }

    type Mutation {
      continueWithGoogle(idToken: String!): AuthPayload!
      login(
        type: String!
        email: String
        password: String
        appleId: String
        idToken: String
        name: String
        notificationToken: String
        isActive: Boolean
      ): LoginProfile!
      startConversation(withUserId: ID!): Conversation!
      sendMessage(conversationId: ID!, body: String!): Message!
      uploadImageToS3(image: String!): UploadedImage!
      ownerLogin(email: String!, password: String!): OwnerLoginPayload!
      refreshToken(refreshToken: String!, userType: String!): RefreshPayload!
    }

    type OwnerLoginPayload {
      userId: ID!
      token: String!
      tokenExpiration: String
      refreshToken: String!
      refreshTokenExpiration: String
      email: String
      userType: String!
      restaurants: [OwnerRestaurantSummary!]!
      permissions: [String!]!
      userTypeId: String
      image: String
      name: String
      isActive: Boolean!
    }

    type OwnerRestaurantSummary {
      id: ID!
      _id: ID!
      orderId: ID
      name: String!
      image: String
      address: String
    }

    type RefreshPayload {
      userId: ID!
      token: String!
      tokenExpiration: String
      refreshToken: String!
      refreshTokenExpiration: String
    }

    type UploadedImage {
      imageUrl: String!
    }

    type Rider {
      id: ID!
      name: String!
      phone: String
      imageUrl: String
      vehicleType: String
      ratingAvg: Float!
      ratingCount: Int!
    }

    type PublicUser {
      id: ID!
      name: String!
      imageUrl: String
      role: String!
    }

    type Conversation {
      id: ID!
      otherUser: PublicUser!
      lastMessageAt: String
      lastMessageBody: String
    }

    type Message {
      id: ID!
      conversationId: ID!
      senderId: ID!
      body: String!
      createdAt: String!
    }

    type AuthUser {
      id: ID!
      name: String!
      email: String
      role: String!
      imageUrl: String
    }

    type AuthPayload {
      token: String!
      user: AuthUser!
    }

    type Configuration {
      _id: ID!
      currency: String
      currencySymbol: String
      deliveryRate: Float
      twilioEnabled: Boolean
      webClientID: String
      webAmplitudeApiKey: String
      googleMapLibraries: String
      googleColor: String
      webSentryUrl: String
      publishableKey: String
      clientId: String
      skipEmailVerification: Boolean
      skipMobileVerification: Boolean
      costType: String
      firebaseKey: String
      authDomain: String
      projectId: String
      storageBucket: String
      msgSenderId: String
      appId: String
    }

    type Location {
      coordinates: [Float!]
    }

    type Address {
      location: Location
      deliveryAddress: String
    }

    type LoginProfile {
      userId: ID!
      token: String!
      tokenExpiration: String
      name: String
      phone: String
      phoneIsVerified: Boolean
      email: String
      emailIsVerified: Boolean
      picture: String
      addresses: [Address!]!
      isNewUser: Boolean!
      userTypeId: String
      isActive: Boolean!
    }
  `,
    catalogTypeDefs,
    orderTypeDefs
  ],
  resolvers: {
    Query: {
      ...catalogResolvers.Query,
      ...orderResolvers.Query,
      health: () => 'ok',

      configuration: async (_parent, _args, ctx) => {
        const appConfig = await ctx.env.DB.prepare(
          'SELECT currency_code, currency_symbol FROM app_config WHERE id = 1'
        ).first<{ currency_code: string; currency_symbol: string }>()
        const googleClientId =
          ctx.env.GOOGLE_CLIENT_IDS?.split(',')[0]?.trim() ?? null
        return {
          _id: 'zego-config',
          currency: appConfig?.currency_code ?? 'USD',
          currencySymbol: appConfig?.currency_symbol ?? '$',
          deliveryRate: 0,
          twilioEnabled: false,
          webClientID: googleClientId,
          webAmplitudeApiKey: null,
          googleMapLibraries: 'places,drawing,geometry',
          googleColor: null,
          webSentryUrl: null,
          publishableKey: null,
          clientId: null,
          skipEmailVerification: true,
          skipMobileVerification: true,
          costType: 'perKM',
          firebaseKey: null,
          authDomain: null,
          projectId: null,
          storageBucket: null,
          msgSenderId: null,
          appId: null
        }
      },

      availableRiders: async (_parent, _args, ctx) => {
        const { results } = await ctx.env.DB.prepare(
          `SELECT u.id, u.name, u.phone, u.image_url,
                  rp.vehicle_type, rp.rating_avg, rp.rating_count,
                  rl.lat, rl.lng
           FROM rider_profiles rp
           JOIN users u ON u.id = rp.user_id
           LEFT JOIN rider_locations rl ON rl.rider_id = u.id
           WHERE rp.is_available = 1 AND u.is_active = 1
           ORDER BY rp.rating_avg DESC`
        ).all<{
          id: string
          name: string
          phone: string | null
          image_url: string | null
          vehicle_type: string | null
          rating_avg: number
          rating_count: number
          lat: number | null
          lng: number | null
        }>()
        return results.map((r) => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
          imageUrl: r.image_url,
          vehicleType: r.vehicle_type,
          ratingAvg: r.rating_avg,
          ratingCount: r.rating_count,
          location:
            r.lat != null && r.lng != null ? { coordinates: [r.lng, r.lat] } : null
        }))
      },

      myConversations: async (_parent, _args, ctx) => {
        const user = requireUser(ctx)
        const { results } = await ctx.env.DB.prepare(
          `SELECT c.id, c.last_message_at,
                  ou.id AS other_id, ou.name AS other_name,
                  ou.image_url AS other_image_url, ou.role AS other_role,
                  (SELECT body FROM messages m WHERE m.conversation_id = c.id
                     ORDER BY m.created_at DESC LIMIT 1) AS last_message_body
           FROM conversations c
           JOIN users ou ON ou.id = CASE
             WHEN c.user_a_id = ? THEN c.user_b_id ELSE c.user_a_id END
           WHERE c.user_a_id = ? OR c.user_b_id = ?
           ORDER BY c.last_message_at DESC`
        )
          .bind(user.sub, user.sub, user.sub)
          .all<{
            id: string
            last_message_at: string | null
            other_id: string
            other_name: string
            other_image_url: string | null
            other_role: string
            last_message_body: string | null
          }>()
        return results.map((r) => ({
          id: r.id,
          lastMessageAt: r.last_message_at,
          lastMessageBody: r.last_message_body,
          otherUser: {
            id: r.other_id,
            name: r.other_name,
            imageUrl: r.other_image_url,
            role: r.other_role
          }
        }))
      },

      messages: async (_parent, args: { conversationId: string }, ctx) => {
        const user = requireUser(ctx)
        const conversation = await ctx.env.DB.prepare(
          'SELECT user_a_id, user_b_id FROM conversations WHERE id = ?'
        )
          .bind(args.conversationId)
          .first<{ user_a_id: string; user_b_id: string }>()
        if (
          !conversation ||
          (conversation.user_a_id !== user.sub &&
            conversation.user_b_id !== user.sub)
        ) {
          throw new AuthError('Forbidden')
        }
        const { results } = await ctx.env.DB.prepare(
          `SELECT id, conversation_id, sender_id, body, created_at
           FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`
        )
          .bind(args.conversationId)
          .all<{
            id: string
            conversation_id: string
            sender_id: string
            body: string
            created_at: string
          }>()
        return results.map((m) => ({
          id: m.id,
          conversationId: m.conversation_id,
          senderId: m.sender_id,
          body: m.body,
          createdAt: m.created_at
        }))
      },

      ownerSession: async (_parent, _args, ctx) => {
        const authUser = requireRole(ctx, 'vendor', 'admin')
        const user = await ctx.env.DB.prepare(
          'SELECT id, email, name, role, image_url, is_active FROM users WHERE id = ?'
        )
          .bind(authUser.sub)
          .first<UserRow>()
        if (!user) throw new AuthError()
        return buildOwnerSessionPayload(user, ctx)
      },

      // Short-lived hand-off token so the customer web app can embed the
      // admin app in an iframe already signed in — minted fresh each time
      // instead of putting the long-lived session token in a URL.
      adminSsoToken: async (_parent, _args, ctx) => {
        const authUser = requireRole(ctx, 'vendor', 'admin')
        return signJWT({ sub: authUser.sub, role: authUser.role }, ctx.env.JWT_SECRET, 120)
      },

      // Hands the rider app a normal (30-day) session token directly — unlike
      // adminSsoToken, the rider app has no separate "verify and issue a
      // fresh token" step, so this token IS what it stores and reuses.
      riderSsoToken: async (_parent, _args, ctx) => {
        const authUser = requireRole(ctx, 'rider')
        const token = await signJWT({ sub: authUser.sub, role: 'rider' }, ctx.env.JWT_SECRET)
        return { userId: authUser.sub, token }
      }
    },

    Mutation: {
      ...catalogResolvers.Mutation,
      ...orderResolvers.Mutation,
      continueWithGoogle: async (_parent, args: { idToken: string }, ctx) => {
        const user = await upsertGoogleUser(args.idToken, ctx)
        const token = await signJWT(
          { sub: user.id, role: user.role as 'customer' },
          ctx.env.JWT_SECRET
        )
        return {
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            imageUrl: user.image_url
          }
        }
      },

      login: async (
        _parent,
        args: {
          type: string
          email?: string
          password?: string
          idToken?: string
          name?: string
        },
        ctx
      ) => {
        let user: UserRow
        let isNewUser = false

        if (args.type === 'google') {
          if (!args.idToken) throw new Error('idToken is required')
          const before = await ctx.env.DB.prepare(
            'SELECT id FROM users WHERE google_id IS NOT NULL AND email = ?'
          )
            .bind(args.email?.toLowerCase() ?? '')
            .first()
          user = await upsertGoogleUser(args.idToken, ctx)
          isNewUser = !before
        } else if (args.type === 'default') {
          if (!args.email || !args.password) {
            throw new Error('email and password are required')
          }
          const found = await ctx.env.DB.prepare(
            'SELECT id, name, email, role, image_url, password_hash FROM users WHERE email = ?'
          )
            .bind(args.email.toLowerCase())
            .first<UserRow>()
          if (
            !found?.password_hash ||
            !(await verifyPassword(args.password, found.password_hash))
          ) {
            throw new Error('Invalid email or password')
          }
          user = found
        } else {
          throw new Error(`Login type "${args.type}" is not supported yet`)
        }

        const token = await signJWT(
          { sub: user.id, role: user.role as 'customer' },
          ctx.env.JWT_SECRET
        )
        const tokenExpiration = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString()

        return {
          userId: user.id,
          token,
          tokenExpiration,
          name: user.name,
          phone: null,
          phoneIsVerified: false,
          email: user.email,
          emailIsVerified: true,
          picture: user.image_url,
          addresses: [],
          isNewUser,
          userTypeId: user.role,
          isActive: true
        }
      },

      startConversation: async (
        _parent,
        args: { withUserId: string },
        ctx
      ) => {
        const user = requireUser(ctx)
        if (user.sub === args.withUserId) {
          throw new Error('Cannot start a conversation with yourself')
        }
        const otherUser = await ctx.env.DB.prepare(
          'SELECT id, name, image_url, role FROM users WHERE id = ?'
        )
          .bind(args.withUserId)
          .first<{
            id: string
            name: string
            image_url: string | null
            role: string
          }>()
        if (!otherUser) throw new Error('User not found')

        const [userAId, userBId] = [user.sub, args.withUserId].sort()
        const existing = await ctx.env.DB.prepare(
          'SELECT id, last_message_at FROM conversations WHERE user_a_id = ? AND user_b_id = ?'
        )
          .bind(userAId, userBId)
          .first<{ id: string; last_message_at: string | null }>()

        const conversationId = existing?.id ?? newId()
        if (!existing) {
          await ctx.env.DB.prepare(
            'INSERT INTO conversations (id, user_a_id, user_b_id) VALUES (?, ?, ?)'
          )
            .bind(conversationId, userAId, userBId)
            .run()
        }

        return {
          id: conversationId,
          lastMessageAt: existing?.last_message_at ?? null,
          lastMessageBody: null,
          otherUser: {
            id: otherUser.id,
            name: otherUser.name,
            imageUrl: otherUser.image_url,
            role: otherUser.role
          }
        }
      },

      sendMessage: async (
        _parent,
        args: { conversationId: string; body: string },
        ctx
      ) => {
        const user = requireUser(ctx)
        const trimmed = args.body.trim()
        if (!trimmed) throw new Error('Message body cannot be empty')

        const conversation = await ctx.env.DB.prepare(
          'SELECT user_a_id, user_b_id FROM conversations WHERE id = ?'
        )
          .bind(args.conversationId)
          .first<{ user_a_id: string; user_b_id: string }>()
        if (
          !conversation ||
          (conversation.user_a_id !== user.sub &&
            conversation.user_b_id !== user.sub)
        ) {
          throw new AuthError('Forbidden')
        }

        const messageId = newId()
        await ctx.env.DB.prepare(
          'INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (?, ?, ?, ?)'
        )
          .bind(messageId, args.conversationId, user.sub, trimmed)
          .run()
        await ctx.env.DB.prepare(
          "UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?"
        )
          .bind(args.conversationId)
          .run()

        const saved = await ctx.env.DB.prepare(
          'SELECT id, conversation_id, sender_id, body, created_at FROM messages WHERE id = ?'
        )
          .bind(messageId)
          .first<{
            id: string
            conversation_id: string
            sender_id: string
            body: string
            created_at: string
          }>()
        return {
          id: saved!.id,
          conversationId: saved!.conversation_id,
          senderId: saved!.sender_id,
          body: saved!.body,
          createdAt: saved!.created_at
        }
      },

      uploadImageToS3: async (_parent, args: { image: string }, ctx) => {
        requireUser(ctx)
        const match = args.image.match(/^data:(.+?);base64,(.+)$/)
        if (!match) {
          throw new Error('image must be a base64 data URL')
        }
        const [, contentType, base64Data] = match
        const bytes = Uint8Array.from(atob(base64Data), (c) =>
          c.charCodeAt(0)
        )
        if (bytes.byteLength > 10 * 1024 * 1024) {
          throw new Error('Image too large (max 10MB)')
        }
        const extension = contentType.split('/')[1] ?? 'bin'
        const key = `${crypto.randomUUID()}.${extension}`
        await ctx.env.UPLOADS.put(key, bytes, {
          httpMetadata: { contentType }
        })
        const origin = new URL(ctx.request.url).origin
        return { imageUrl: `${origin}/uploads/${key}` }
      },

      ownerLogin: async (
        _parent,
        args: { email: string; password: string },
        ctx
      ) => {
        const user = await ctx.env.DB.prepare(
          `SELECT id, email, name, role, image_url, is_active, password_hash FROM users
           WHERE email = ? AND role IN ('vendor', 'admin')`
        )
          .bind(args.email.toLowerCase())
          .first<UserRow & { password_hash: string | null }>()
        if (
          !user?.password_hash ||
          !(await verifyPassword(args.password, user.password_hash))
        ) {
          throw new Error('Invalid email or password')
        }
        return buildOwnerSessionPayload(user, ctx)
      },

      refreshToken: async (
        _parent,
        args: { refreshToken: string; userType: string },
        ctx
      ) => {
        const payload = await verifyJWT(args.refreshToken, ctx.env.JWT_SECRET)
        if (!payload || payload.kind !== 'refresh') {
          throw new AuthError('Invalid refresh token')
        }
        const token = await signJWT(
          { sub: payload.sub, role: payload.role },
          ctx.env.JWT_SECRET
        )
        const refreshToken = await signJWT(
          { sub: payload.sub, role: payload.role, kind: 'refresh' },
          ctx.env.JWT_SECRET,
          90 * 24 * 60 * 60
        )
        return {
          userId: payload.sub,
          token,
          tokenExpiration: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
          refreshToken,
          refreshTokenExpiration: new Date(
            Date.now() + 90 * 24 * 60 * 60 * 1000
          ).toISOString()
        }
      }
    }
  }
})

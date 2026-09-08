import { createSchema } from 'graphql-yoga'
import { signJWT } from './auth'
import { verifyGoogleIdToken } from './google'
import { AuthError, requireUser, type GraphQLContext } from './context'

function newId(): string {
  return crypto.randomUUID()
}

export const schema = createSchema<GraphQLContext>({
  typeDefs: /* GraphQL */ `
    type Query {
      health: String!
      availableRiders: [Rider!]!
      myConversations: [Conversation!]!
      messages(conversationId: ID!): [Message!]!
    }

    type Mutation {
      continueWithGoogle(idToken: String!): AuthPayload!
      startConversation(withUserId: ID!): Conversation!
      sendMessage(conversationId: ID!, body: String!): Message!
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
  `,
  resolvers: {
    Query: {
      health: () => 'ok',

      availableRiders: async (_parent, _args, ctx) => {
        const { results } = await ctx.env.DB.prepare(
          `SELECT u.id, u.name, u.phone, u.image_url,
                  rp.vehicle_type, rp.rating_avg, rp.rating_count
           FROM rider_profiles rp
           JOIN users u ON u.id = rp.user_id
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
        }>()
        return results.map((r) => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
          imageUrl: r.image_url,
          vehicleType: r.vehicle_type,
          ratingAvg: r.rating_avg,
          ratingCount: r.rating_count
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
      }
    },

    Mutation: {
      continueWithGoogle: async (_parent, args: { idToken: string }, ctx) => {
        if (!ctx.env.GOOGLE_CLIENT_IDS) {
          throw new Error('Google Sign-In is not configured on this server')
        }
        const payload = await verifyGoogleIdToken(
          args.idToken,
          ctx.env.GOOGLE_CLIENT_IDS
        )
        const email = payload.email!.toLowerCase()

        let user = await ctx.env.DB.prepare(
          'SELECT id, name, email, role, image_url FROM users WHERE google_id = ?'
        )
          .bind(payload.sub)
          .first<{
            id: string
            name: string
            email: string
            role: string
            image_url: string | null
          }>()

        if (!user) {
          const existingByEmail = await ctx.env.DB.prepare(
            'SELECT id, name, email, role, image_url FROM users WHERE email = ?'
          )
            .bind(email)
            .first<{
              id: string
              name: string
              email: string
              role: string
              image_url: string | null
            }>()

          if (existingByEmail) {
            await ctx.env.DB.prepare(
              'UPDATE users SET google_id = ? WHERE id = ?'
            )
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
      }
    }
  }
})

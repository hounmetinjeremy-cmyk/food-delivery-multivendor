import { verifyJWT, type JwtPayload } from './auth'

export interface Env {
  DB: D1Database
  UPLOADS: R2Bucket
  ASSETS?: Fetcher
  JWT_SECRET: string
  GOOGLE_CLIENT_IDS?: string
  ENVIRONMENT: string
}

export interface GraphQLContext {
  env: Env
  request: Request
  user: JwtPayload | null
}

export async function createContext(request: Request, env: Env): Promise<GraphQLContext> {
  const authHeader = request.headers.get('authorization')
  let user: JwtPayload | null = null
  if (authHeader?.startsWith('Bearer ')) {
    user = await verifyJWT(authHeader.slice(7), env.JWT_SECRET)
  }
  return { env, request, user }
}

export class AuthError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'AuthError'
  }
}

export function requireUser(ctx: GraphQLContext): JwtPayload {
  if (!ctx.user) throw new AuthError()
  return ctx.user
}

export function requireRole(ctx: GraphQLContext, ...roles: JwtPayload['role'][]): JwtPayload {
  const user = requireUser(ctx)
  if (!roles.includes(user.role)) throw new AuthError('Forbidden')
  return user
}

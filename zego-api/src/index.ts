import { createYoga } from 'graphql-yoga'
import { createContext, type Env, type GraphQLContext } from './context'
import { schema } from './schema'
import { handlePlaceSearch, handleReverseGeocode } from './maps'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/uploads/')) {
      const key = url.pathname.slice('/uploads/'.length)
      const object = await env.UPLOADS.get(key)
      if (!object) return new Response('Not found', { status: 404 })
      return new Response(object.body, {
        headers: {
          'content-type':
            object.httpMetadata?.contentType ?? 'application/octet-stream',
          'cache-control': 'public, max-age=31536000, immutable'
        }
      })
    }

    if (url.pathname === '/maps/reverse-geocode') {
      return handleReverseGeocode(request)
    }
    if (url.pathname === '/maps/search') {
      return handlePlaceSearch(request)
    }

    const yoga = createYoga<GraphQLContext>({
      schema,
      graphqlEndpoint: '/graphql',
      context: () => createContext(request, env),
      landingPage: env.ENVIRONMENT !== 'production',
      cors: {
        origin: '*',
        methods: ['POST', 'OPTIONS']
      }
    })
    return yoga.fetch(request)
  }
}

import { createYoga } from 'graphql-yoga'
import { createContext, type Env, type GraphQLContext } from './context'
import { schema } from './schema'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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

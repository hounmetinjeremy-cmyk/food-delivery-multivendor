import { createYoga, createSchema } from 'graphql-yoga'
import { createContext, type Env, type GraphQLContext } from './context'

const schema = createSchema<GraphQLContext>({
  typeDefs: /* GraphQL */ `
    type Query {
      health: String!
    }
  `,
  resolvers: {
    Query: {
      health: () => 'ok'
    }
  }
})

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const yoga = createYoga<GraphQLContext>({
      schema,
      graphqlEndpoint: '/graphql',
      context: () => createContext(request, env),
      landingPage: env.ENVIRONMENT !== 'production'
    })
    return yoga.fetch(request)
  }
}

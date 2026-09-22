import { createYoga, createSchema } from 'graphql-yoga';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';
import { verifyJWT } from './auth.js';

const schema = createSchema({ typeDefs, resolvers });

const yoga = createYoga({
  schema,
  graphqlEndpoint: '/graphql',
  cors: {
    origin: '*',
    credentials: false,
  },
  context: async ({ request, env }) => {
    let user = null;
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
      const payload = await verifyJWT(token, env.JWT_SECRET);
      if (payload) user = payload;
    }

    return { env, user };
  },
});

export default {
  fetch: (request, env, ctx) => yoga.fetch(request, env, ctx),
};

const { createServer } = require('node:http');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');
const mongoose = require('mongoose');
const { createYoga, createSchema } = require('graphql-yoga');
const { typeDefs } = require('./schema');
const { resolvers } = require('./resolvers');
const { getUserIdFromRequest, verifyToken } = require('./auth');

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('MONGO_URI manquant dans les variables d\'environnement.');
  process.exit(1);
}

mongoose.set('strictQuery', true);

const schema = createSchema({ typeDefs, resolvers });

const yoga = createYoga({
  schema,
  graphqlEndpoint: '/graphql',
  context: async ({ request }) => ({
    userId: getUserIdFromRequest(request),
  }),
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
  },
});

const server = createServer(yoga);

// Subscriptions temps réel via le protocole graphql-ws, sur le même chemin /graphql
// (c'est ce que les apps attendent en wss://.../graphql).
const wsServer = new WebSocketServer({ server, path: '/graphql' });

useServer(
  {
    schema,
    context: async (ctx) => {
      const authHeader =
        (ctx.connectionParams && (ctx.connectionParams.authorization || ctx.connectionParams.Authorization)) || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const payload = token ? verifyToken(token) : null;
      return { userId: payload ? payload.userId : null };
    },
  },
  wsServer
);

async function start() {
  await mongoose.connect(MONGO_URI);
  console.log('Connecté à MongoDB Atlas');

  server.listen(PORT, () => {
    console.log(`Serveur Enatega prêt sur le port ${PORT} (GraphQL + WebSocket sur /graphql)`);
  });
}

start().catch((err) => {
  console.error('Échec du démarrage du serveur:', err);
  process.exit(1);
});

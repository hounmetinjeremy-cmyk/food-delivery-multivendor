import { execute } from './runtime.js';
import { resolvers } from './resolvers.js';
import { verifyJWT } from './auth.js';
import { typeDefs } from './schema.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method !== 'POST' || url.pathname !== '/graphql') {
      return jsonResponse({ error: 'Not Found' }, 404);
    }

    try {
      const body = await request.json();
      const query = body.query;
      const variables = body.variables || {};

      if (!query) {
        return jsonResponse({ errors: [{ message: 'Missing query' }] }, 400);
      }

      let user = null;
      const authHeader = request.headers.get('authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (token) {
        const payload = await verifyJWT(token, env.JWT_SECRET);
        if (payload) user = payload;
      }

      const context = { env, user, request, typeDefs };
      const data = await execute({ query, variables }, resolvers, context);

      return jsonResponse({ data }, 200);
    } catch (err) {
      return jsonResponse({ errors: [{ message: err.message }] }, 200);
    }
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

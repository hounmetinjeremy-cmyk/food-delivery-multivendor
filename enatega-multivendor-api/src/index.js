import { execute } from './runtime.js';
import { resolvers } from './resolvers.js';
import { verifyJWT } from './auth.js';
import { typeDefs } from './schema.js';

export { RealtimeHub } from './durable-object.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (
      request.method === 'GET' &&
      url.pathname === '/graphql' &&
      request.headers.get('Upgrade') === 'websocket'
    ) {
      return handleRealtime(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/graphql') {
      return handleGraphQL(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/upload') {
      return handleUpload(request, env, url);
    }

    if (request.method === 'GET' && url.pathname.startsWith('/images/')) {
      return handleImage(env, url);
    }

    return jsonResponse({ error: 'Not Found' }, 404);
  },
};

function handleRealtime(request, env) {
  if (!env.REALTIME) {
    return new Response('Temps réel non configuré', { status: 500 });
  }
  const id = env.REALTIME.idFromName('global');
  const stub = env.REALTIME.get(id);
  return stub.fetch(request);
}

async function getAuthUser(request, env) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const payload = await verifyJWT(token, env.JWT_SECRET);
  return payload || null;
}

async function handleGraphQL(request, env) {
  try {
    const body = await request.json();
    const query = body.query;
    const variables = body.variables || {};

    if (!query) {
      return jsonResponse({ errors: [{ message: 'Missing query' }] }, 400);
    }

    const user = await getAuthUser(request, env);
    const context = { env, user, request, typeDefs };
    const data = await execute({ query, variables }, resolvers, context);

    return jsonResponse({ data }, 200);
  } catch (err) {
    return jsonResponse({ errors: [{ message: err.message }] }, 200);
  }
}

async function handleUpload(request, env, url) {
  if (!env.STORAGE) {
    return jsonResponse({ error: 'Stockage non configuré (binding STORAGE manquant)' }, 500);
  }

  const user = await getAuthUser(request, env);
  if (!user) {
    return jsonResponse({ error: 'Authentification requise' }, 401);
  }

  const contentType = request.headers.get('content-type') || '';
  let fileData;
  let fileName = 'upload';
  let fileType = 'application/octet-stream';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return jsonResponse({ error: 'Champ "file" manquant' }, 400);
    }
    fileData = await file.arrayBuffer();
    fileName = file.name || fileName;
    fileType = file.type || fileType;
  } else {
    fileData = await request.arrayBuffer();
    fileName = url.searchParams.get('filename') || fileName;
    fileType = contentType || fileType;
  }

  if (!fileData || fileData.byteLength === 0) {
    return jsonResponse({ error: 'Fichier vide' }, 400);
  }

  const ext = (fileName.split('.').pop() || 'bin').toLowerCase().slice(0, 8);
  const key = `${crypto.randomUUID()}.${ext}`;

  await env.STORAGE.put(key, fileData, {
    httpMetadata: { contentType: fileType },
  });

  return jsonResponse({ url: `${url.origin}/images/${key}`, key }, 201);
}

async function handleImage(env, url) {
  if (!env.STORAGE) {
    return jsonResponse({ error: 'Stockage non configuré' }, 500);
  }
  const key = decodeURIComponent(url.pathname.replace('/images/', ''));
  const object = await env.STORAGE.get(key);
  if (!object) {
    return jsonResponse({ error: 'Image introuvable' }, 404);
  }
  const headers = new Headers(corsHeaders());
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { status: 200, headers });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

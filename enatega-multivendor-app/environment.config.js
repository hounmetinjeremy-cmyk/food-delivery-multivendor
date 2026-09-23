const APP_MODES = {
  MULTI: 'MULTI',
  SINGLE: 'SINGLE'
}

// Backend auto-heberge (Cloudflare Worker + Daytona/D1), remplace le backend
// officiel Enatega (proprietaire/payant : aws-server-v2.enatega.com).
// Pas de WebSocket/REST implementes cote serveur pour l'instant : les
// abonnements temps reel (suivi livraison en direct) et les endpoints REST
// ne fonctionneront pas tant qu'ils ne sont pas ajoutes au Worker.
const SELF_HOSTED_HOST = 'food-delivery-multivendor.hounmetinjeremy.workers.dev'

const MULTI_ENV_CONFIG = {
  development: {
    GRAPHQL_URL: `https://${SELF_HOSTED_HOST}/graphql`,
    WS_GRAPHQL_URL: `wss://${SELF_HOSTED_HOST}/graphql`,
    SERVER_URL: `https://${SELF_HOSTED_HOST}/graphql`,
    SERVER_REST_URL: `https://${SELF_HOSTED_HOST}/`,
    CLARITY_ENABLED: true
  },
  staging: {
    GRAPHQL_URL: `https://${SELF_HOSTED_HOST}/graphql`,
    WS_GRAPHQL_URL: `wss://${SELF_HOSTED_HOST}/graphql`,
    SERVER_URL: `https://${SELF_HOSTED_HOST}/graphql`,
    SERVER_REST_URL: `https://${SELF_HOSTED_HOST}/`,
    CLARITY_ENABLED: true
  },
  production: {
    GRAPHQL_URL: `https://${SELF_HOSTED_HOST}/graphql`,
    WS_GRAPHQL_URL: `wss://${SELF_HOSTED_HOST}/graphql`,
    SERVER_URL: `https://${SELF_HOSTED_HOST}/graphql`,
    SERVER_REST_URL: `https://${SELF_HOSTED_HOST}/`,
    CLARITY_ENABLED: true
  }
}

// Single-vendor production backend. Environment variables can still override
// it for local or staging builds when needed.
const SINGLE_VENDOR_DEFAULT_HOST =
  'enatega-multivendor-api-production-9b09.up.railway.app'

const getSingleVendorConfig = () => {
  const graphqlUrl = process.env.EXPO_PUBLIC_SINGLE_VENDOR_GRAPHQL_URL
  const wsGraphqlUrl = process.env.EXPO_PUBLIC_SINGLE_VENDOR_WS_GRAPHQL_URL
  const serverRestUrl = process.env.EXPO_PUBLIC_SINGLE_VENDOR_REST_URL
  const explicitlyEnabled =
    process.env.EXPO_PUBLIC_SINGLE_VENDOR_ENABLED === 'true'

  if (graphqlUrl && wsGraphqlUrl && serverRestUrl) {
    return {
      GRAPHQL_URL: graphqlUrl,
      WS_GRAPHQL_URL: wsGraphqlUrl,
      SERVER_URL: graphqlUrl,
      SERVER_REST_URL: serverRestUrl,
      CLARITY_ENABLED: false,
      PUBLIC_ACCESS_REQUIRED: true,
      SINGLE_VENDOR_ENABLED: explicitlyEnabled
    }
  }

  return {
    GRAPHQL_URL: `https://${SINGLE_VENDOR_DEFAULT_HOST}/graphql`,
    WS_GRAPHQL_URL: `wss://${SINGLE_VENDOR_DEFAULT_HOST}/graphql`,
    SERVER_URL: `https://${SINGLE_VENDOR_DEFAULT_HOST}/graphql`,
    SERVER_REST_URL: `https://${SINGLE_VENDOR_DEFAULT_HOST}/`,
    CLARITY_ENABLED: false,
    PUBLIC_ACCESS_REQUIRED: true,
    SINGLE_VENDOR_ENABLED:
      process.env.EXPO_PUBLIC_SINGLE_VENDOR_ENABLED !== 'false'
  }
}

const normalizeEnvironment = (env) => {
  if (env === 'production' || env === 'staging') return env
  return 'development'
}

const getEnvironmentConfig = (env, mode = APP_MODES.MULTI) => {
  const environment = normalizeEnvironment(env)

  if (mode === APP_MODES.SINGLE) {
    return getSingleVendorConfig()
  }

  return {
    ...MULTI_ENV_CONFIG[environment],
    PUBLIC_ACCESS_REQUIRED: true,
    SINGLE_VENDOR_ENABLED: getSingleVendorConfig().SINGLE_VENDOR_ENABLED
  }
}

module.exports = {
  ENV_CONFIG: MULTI_ENV_CONFIG,
  MULTI_ENV_CONFIG,
  getEnvironmentConfig,
  normalizeEnvironment
}

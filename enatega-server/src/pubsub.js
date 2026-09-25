const { PubSub } = require('graphql-subscriptions');

// Instance unique en mémoire. Suffisant tant que le serveur tourne sur une
// seule instance Render (pas de mise à l'échelle horizontale pour l'instant).
const pubsub = new PubSub();

const EVENTS = {
  ORDER_UPDATED: (orderId) => `ORDER_UPDATED_${orderId}`,
  ORDER_TRACKING_UPDATED: (orderId) => `ORDER_TRACKING_UPDATED_${orderId}`,
  RIDER_LOCATION_UPDATED: (riderId) => `RIDER_LOCATION_UPDATED_${riderId}`,
  ORDER_STATUS_CHANGED_FOR_USER: (userId) => `ORDER_STATUS_CHANGED_${userId}`,
  NEW_CHAT_MESSAGE: (orderId) => `NEW_CHAT_MESSAGE_${orderId}`,
};

module.exports = { pubsub, EVENTS };

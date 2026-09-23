// Durable Object qui gère les connexions WebSocket pour le suivi de commande en temps réel.
// Une seule instance globale ("global") maintient les abonnements par orderId.
export class RealtimeHub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.subscriptions = new Map(); // orderId -> Set<{ ws, id }>
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Appel interne du Worker principal quand une commande change de statut.
    if (request.method === 'POST' && url.pathname === '/notify') {
      const { orderId, order } = await request.json();
      this.broadcast(orderId, order);
      return new Response('ok');
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.attach(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  // Protocole compatible graphql-ws : connection_init / subscribe / next / complete.
  attach(ws) {
    const subscriptionIds = new Map(); // id du message -> orderId

    ws.addEventListener('message', (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === 'connection_init') {
        ws.send(JSON.stringify({ type: 'connection_ack' }));
        return;
      }

      if (msg.type === 'subscribe' || msg.type === 'start') {
        const orderId = msg.payload?.variables?.orderId;
        if (!orderId) return;
        subscriptionIds.set(msg.id, orderId);
        if (!this.subscriptions.has(orderId)) this.subscriptions.set(orderId, new Set());
        this.subscriptions.get(orderId).add({ ws, id: msg.id });
        return;
      }

      if (msg.type === 'complete' || msg.type === 'stop') {
        const orderId = subscriptionIds.get(msg.id);
        if (orderId && this.subscriptions.has(orderId)) {
          for (const sub of this.subscriptions.get(orderId)) {
            if (sub.ws === ws && sub.id === msg.id) this.subscriptions.get(orderId).delete(sub);
          }
        }
        subscriptionIds.delete(msg.id);
        return;
      }
    });

    ws.addEventListener('close', () => {
      for (const subs of this.subscriptions.values()) {
        for (const sub of subs) {
          if (sub.ws === ws) subs.delete(sub);
        }
      }
    });
  }

  broadcast(orderId, order) {
    const subs = this.subscriptions.get(orderId);
    if (!subs) return;
    for (const sub of subs) {
      try {
        sub.ws.send(
          JSON.stringify({
            type: 'next',
            id: sub.id,
            payload: { data: { orderStatusChanged: order } },
          }),
        );
      } catch {
        subs.delete(sub);
      }
    }
  }
}

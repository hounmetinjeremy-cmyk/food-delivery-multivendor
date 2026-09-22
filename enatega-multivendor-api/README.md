# enatega-multivendor-api (backend maison, remplace l'API propriétaire Enatega)

Backend GraphQL déployé sur **Cloudflare Workers**, avec **Cloudflare D1** (SQLite) comme
base de données — remplace le backend Node/Express + MongoDB propriétaire d'Enatega.

Les noms de champs GraphQL (`freeDelivery`, `acceptVouchers`, `nearByRestaurantsPreview`,
etc.) sont alignés sur ceux attendus par les apps du repo (`enatega-multivendor-app`,
`-store`, `-rider`, `-web`, `-admin`) pour limiter les changements côté frontend.

## Setup

```bash
npm install

# Créer la base D1 (une seule fois)
npx wrangler d1 create enatega-multivendor-db
# → copier le database_id retourné dans wrangler.jsonc

# Appliquer le schéma
npm run db:migrate:local     # pour le dev local
npm run db:migrate:remote    # pour la prod

# Définir le secret JWT (prod)
npx wrangler secret put JWT_SECRET

# Lancer en local
npm run dev

# Déployer
npm run deploy
```

## Statut actuel (v0.1 — squelette fonctionnel)

Implémenté :
- Auth : `register`, `login` (JWT + PBKDF2, sans dépendance Node)
- Restaurants : `restaurants`, `restaurant(id)`, `nearByRestaurantsPreview`,
  `createRestaurant`, `editRestaurant` (avec `freeDelivery` / `acceptVouchers`, cf.
  QUAL-012)
- Commandes : `placeOrder`, `myOrders`, `updateOrderStatus`

Pas encore fait (prochaines étapes) :
- Catégories / foods / variations : mutations create/edit
- Gestion des livreurs (assignation, tracking temps réel)
- Upload d'images (Cloudflare R2 recommandé)
- Paiement (Stripe/PayPal ou Mobile Money)
- Notifications push
- Connexion réelle des 6 apps à cette API (changer l'URL du serveur GraphQL dans
  `environment.js` / `environment.config.js` de chaque app)

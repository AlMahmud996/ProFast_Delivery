# ZAPSHIFT server (modular Express)

Same API as the old single `index.js`, split into folders.

    npm install express cors dotenv mongodb stripe firebase-admin
    node index.js

Keep these two files in the project ROOT (next to index.js), exactly like before:
- `firebase-admin_key.json`  (keep it in .gitignore)
- `warehouse.json`

`.env` needs: `MONGODB_URI` (or `DB_USER` + `DB_PASS`), `STRIPE_SECRET_KEY`, optional `PORT`.
`package.json` must contain `"type": "module"`.

## Where things live
- `index.js`        starts the server (connect DB, run startup tasks, listen)
- `app.js`          express app + middlewares
- `config/`         db (collections), firebase, stripe
- `constants/`      delivery rules, pricing table, money settings
- `utils/`          pure helpers (pricing, routes, geo, journey, money)
- `middlewares/`    verifyFBToken, verifyAdmin, verifyRider
- `services/`       notifications, rider assignment, finance, startup tasks
- `controllers/`    the logic of each route
- `routes/`         URL lists (routes/index.js shows every group)

## Adding a new route
1. Write the handler in a `controllers/*.controller.js`
2. Add one line in the matching `routes/*.routes.js`

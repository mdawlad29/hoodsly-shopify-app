# Hoodsly Shopify App

A custom Shopify app for Hoodsly store with Product Configurator, HoodslyHub Order Sync, and bonus features.

## Tech Stack

- **Framework:** Remix (Shopify CLI 3.x)
- **Frontend:** React + Shopify Polaris
- **Backend:** Node.js
- **Database:** MySQL (via Prisma)
- **Shopify Functions:** JavaScript (Cart Transform)

## Prerequisites

- Node.js >= 18
- Shopify Partner account
- MySQL running locally
- Shopify CLI: `npm install -g @shopify/cli`

## Installation

```bash
git clone https://github.com/mdawlad29/hoodsly-shopify-app
cd hoodsly-shopify-app
npm install
cp .env.example .env
# Fill in .env values (see Environment Variables section)
npx prisma migrate dev --name init
shopify app dev
```

## Project Structure

```
hoodsly-shopify-app/
├── app/
│   ├── routes/
│   │   ├── app._index.jsx              # Dashboard
│   │   ├── app.configurator.$id.jsx    # Task 1: Schema Builder
│   │   ├── app.sync-log.jsx            # Task 2: HoodslyHub Sync Log
│   │   ├── app.order-report.jsx        # Bonus: Order Report + CSV
│   │   ├── app.rush-orders.jsx         # Bonus: Rush Order Queue
│   │   └── webhooks.jsx                # Webhook Handler
│   └── services/
│       ├── hoodslyHub.server.js        # Sync + Retry logic
│       ├── hubspot.server.js           # HubSpot integration
│       └── birdeye.server.js           # BirdEye integration
├── extensions/
│   ├── theme-app-extension/            # Task 1: Storefront renderer
│   │   └── blocks/configurator.liquid
│   └── cart-transform/                 # Price calculation function
│       └── src/index.js
└── prisma/
    └── schema.prisma
```

## Data Model (Configurator)

Stored as product metafield: `hoodsly.configurator_definition` (type: `json`)

```json
{
  "fields": [
    {
      "id": "color_option",
      "type": "dropdown",
      "label": "Color Options",
      "required": true,
      "order": 1,
      "options": [
        { "label": "Standard White", "value": "white", "priceAdder": 0 },
        { "label": "Custom Color", "value": "custom", "priceAdder": 150 }
      ],
      "conditions": []
    },
    {
      "id": "sw_color_code",
      "type": "text",
      "label": "Sherwin-Williams Color Code",
      "required": false,
      "order": 2,
      "options": [],
      "conditions": [
        { "fieldId": "color_option", "operator": "equals", "value": "custom" }
      ]
    }
  ]
}
```

## Webhook Events

| Event              | Action                               |
| ------------------ | ------------------------------------ |
| `orders/create`    | Sync to HoodslyHub + Send to HubSpot |
| `orders/fulfilled` | Send BirdEye review request          |

## HoodslyHub Retry Logic

- **Max retries:** 3
- **Backoff:** Exponential (1 min → 5 min → 25 min)
- **Final state:** `permanently_failed` after 3 failures
- **Manual retry:** Available from Admin Sync Log page

## Completed Tasks

- [x] Task 1: Product Configurator — Admin Schema Builder
- [x] Task 1: Storefront Liquid Renderer with conditional fields
- [x] Task 1: Price adder calculation (base + options)
- [x] Task 2: HoodslyHub order sync on order creation
- [x] Task 2: Exponential backoff retry (3 attempts)
- [x] Task 2: Admin Sync Log with search, filter, manual retry
- [x] Bonus: Order Report with date/tag filter + CSV export
- [x] Bonus: HubSpot contact + deal creation on order
- [x] Bonus: Rush Order priority queue in admin
- [x] Bonus: BirdEye review request on fulfillment

## Incomplete Tasks

- **BirdEye:** Mock endpoint ready and retry logic implemented, but fulfillment webhook needs live store testing to fully verify end-to-end flow.

## Environment Variables

See `.env.example` for all required variables.

| Variable               | Description                    |
| ---------------------- | ------------------------------ |
| `DATABASE_URL`         | MySQL connection string        |
| `SHOPIFY_API_KEY`      | From Shopify Partner dashboard |
| `SHOPIFY_API_SECRET`   | From Shopify Partner dashboard |
| `HOODSLYHUB_ENDPOINT`  | Mock HoodslyHub POST endpoint  |
| `HUBSPOT_ACCESS_TOKEN` | HubSpot private app token      |
| `BIRDEYE_ENDPOINT`     | Mock BirdEye POST endpoint     |
| `SESSION_SECRET`       | Random secret string           |

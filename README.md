# Hoodsly Shopify App

A custom Shopify app for Hoodsly store with Product Configurator, HoodslyHub Order Sync, and bonus features.

## Tech Stack

- **Framework:** Remix (Shopify CLI 3.x)
- **Frontend:** React + Shopify Polaris
- **Backend:** Node.js
- **Database:** SQLite (via Prisma) — for sync logs
- **Shopify Functions:** JavaScript (Cart Transform)

## Prerequisites

- Node.js >= 18
- Shopify Partner account
- Shopify CLI: `npm install -g @shopify/cli`

## Installation

```bash
git clone https://github.com/YOUR_USERNAME/hoodsly-shopify-app
cd hoodsly-shopify-app
npm install
cp .env.example .env
# Fill in .env values
npx prisma migrate dev
shopify app dev
```

## Data Model (Configurator)

Stored as product metafield: `hoodsly.configurator_definition` (type: json)

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

## Incomplete Tasks

- BirdEye integration: Mock endpoint ready, but fulfillment webhook needs store-specific testing.

## Environment Variables

See `.env.example`
# wppool

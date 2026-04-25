# delightful_agent_buy

Next.js demo for moneydevkit checkout, customers, and L402.

Theme: **Cindy - AI Art Sorceress** creator tipping platform.

## Features

- Human tip flow with prebuilt amounts: `$5`, `$10`, `$25`, and `Custom`
- moneydevkit checkout integration (`useCheckout`)
- Customer data collection (`name`, `email`, `externalId`) for dashboard customers
- Hosted checkout route (`/checkout/[id]`)
- Payment verification route (`/checkout/success`)
- L402-protected route for AI-agent tips (`/api/agent-tip`)

## Setup

```bash
cd web
npm install
cp .env.local.example .env.local
```

Set credentials in `web/.env.local`:

```env
MDK_ACCESS_TOKEN=your_mdk_access_token
MDK_MNEMONIC=your_mdk_mnemonic
```

Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Important Routes

- `/` - Cindy tipping UI
- `/checkout/[id]` - hosted moneydevkit checkout page
- `/checkout/success` - payment success verification
- `/api/mdk` - moneydevkit unified endpoint
- `/api/agent-tip` - L402 protected API endpoint (agent pays to access)

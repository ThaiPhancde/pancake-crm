# Pancake CRM

A CRM for teams that manage multiple Pancake POS shops.
Each shop has its own workspace, navigation, order lists, customer records, and reports.

This project builds on [Comp AI CRM](https://github.com/trycompai/crm).
The Pancake integration reads POS data into PostgreSQL.
Tasks and notes stay inside this CRM.

## Features

- Switch between shop workspaces with a dedicated sidebar.
- Browse synchronized orders, customers, products, and staff.
- Review order details, delivery history, and customer purchases.
- Open operational groups for pending, shipping, returned, and unassigned orders.
- Create CRM tasks and notes from order details. Assign, complete, and reopen tasks.
- Control shop access with manager, telesale, and viewer roles.
- Read synchronized data through a local MCP server.
- Use the inherited CRM and optional research agent alongside the shop workspaces.

The POS client sends GET requests only.
CRM tasks and notes do not change records in Pancake POS.
The sync worker and MCP server do not call AI models.

Some shop pages contain interface controls without backend support.
See [Issues](#issues) before planning a deployment.

## Shop workspaces

Sign in and open `/[slug]/shop`, where `[slug]` is your CRM workspace slug.
The app opens the first shop you have permission to view.
Use the shop selector to change shops or return to the CRM dashboard.

| Page | Route under `/[slug]/shop/[shopId]` |
| --- | --- |
| Overview | `/` |
| Orders | `/orders` |
| Contacts | `/contacts` |
| Products | `/products` |
| Leads | `/leads` |
| Calendar | `/calendar` |
| Tickets | `/tickets` |
| Reports and tasks | `/reports/*` |
| Shop settings | `/settings/*` |

Existing `/[slug]/pancake` links redirect to the shop workspace and preserve supported filters.
A page in this table does not mean all its controls have backend support.
The [workspace handoff](./docs/shop-workspaces-handoff.md) lists the remaining work.

## Local setup

Use Bun 1.3.12, Node.js 22 or newer, and PostgreSQL.
Docker is optional for an existing PostgreSQL installation.
Run all commands from the repository root.

```sh
git clone https://github.com/ThaiPhancde/pancake-crm.git
cd pancake-crm
bun install
```

Copy `.env.example` to `.env`:

```sh
cp .env.example .env
```

On PowerShell:

```powershell
Copy-Item .env.example .env
```

Set these values before starting the app:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection for CRM data |
| `BETTER_AUTH_SECRET` | A generated session secret |
| `ALLOWED_SIGN_IN` | Allowed email addresses or domains, separated by commas |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in credentials |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Alternative Microsoft sign-in credentials |
| `API_URL`, `APP_URL` | API and web app origins |

Configure at least one sign-in provider. Set each provider's ID and secret together.
Register `<API_URL>/api/auth/callback/google` or `<API_URL>/api/auth/callback/microsoft` with that provider.
See the [setup guide](./docs/setup.md) and [environment guide](./docs/environment.md) for details.

All processes read the root `.env`.
Keep credentials there or in your hosting environment.
The [environment example](./.env.example) lists optional settings, including AI and telemetry controls.

### Development with Docker

The supplied Docker configuration creates a local `crm` database on port 5432.
The default `DATABASE_URL` in `.env.example` matches this database.

```sh
docker compose up -d
bun run db:deploy
bun run db:generate
bun run dev
```

The development app uses `http://localhost:3000`.
The API uses `http://localhost:3001`.
Pancake shop configuration requires a dedicated database named `CRM` or `comp_ai_crm`.
Use the Windows deployment path below for that configuration.

### Windows with an existing PostgreSQL server

Create a dedicated database named `CRM` or `comp_ai_crm`.
Set `DATABASE_URL` to that database.
Set `APP_URL` to `http://localhost:3100` and `API_URL` to `http://localhost:3101`.
Register the OAuth callback with the same API origin.

```powershell
bun run windows:deploy
.\scripts\windows\Start-Crm.ps1 -Production
```

The starter runs the web app, API, and Pancake sync worker.
The web app uses port 3100. The API uses port 3101.
Logs are stored in `.logs/`.
Register automatic startup and process recovery for the current Windows account:

```powershell
.\scripts\windows\Register-CrmStartup.ps1
```

The task checks processes every minute and starts missing CRM processes.
`Stop-Crm.ps1` pauses recovery. Run `Start-Crm.ps1 -Production` to resume it.

```powershell
.\scripts\windows\Stop-Crm.ps1
```

Read the [Windows deployment guide](./docs/pancake-windows.md) for configuration and process management.
Its machine-specific paths and deployment observations describe the existing installation.

## Connect Pancake POS

Add shop IDs and credential references to the root `.env`.
Use the actual shop ID and your own API key.

```dotenv
PANCAKE_LIVE_SYNC_ENABLED="0"
PANCAKE_SHOPS_JSON='[{"id":"12345","name":"Shop A","apiKeyEnv":"PANCAKE_API_KEY_SHOP_A","webhookTokenEnv":"PANCAKE_WEBHOOK_TOKEN_SHOP_A"}]'
PANCAKE_API_KEY_SHOP_A=""
PANCAKE_WEBHOOK_TOKEN_SHOP_A=""
```

Use a separate webhook token with at least 32 characters.
Set `TEST_DATABASE_URL` to an isolated local test database named `comp_ai_crm_test`.
Run fixture verification before configuring shops:

```sh
bun run db:test
bun run pancake:test
bun run pancake:configure
```

The configuration command checks fixture evidence against the current source fingerprint.
New shops start with live sync disabled.
Approve each shop explicitly:

```sh
bun run pancake:configure --shop 12345 --approve-read-only
```

Set `PANCAKE_LIVE_SYNC_ENABLED="1"` and restart the worker to start synchronization.
The Windows starter includes the worker. Other deployments run it separately:

```sh
bun run pancake:worker
```

The worker uses polling and saves checkpoints for each resource.
Webhook requests queue a data refresh.
Configure webhook delivery in Pancake with a separate HTTPS endpoint and token.
See the [integration guide](./docs/pancake-windows.md#webhook) for endpoint details.

## Access and reports

Workspace owners and admins manage all shops.
Other accounts require explicit shop permissions.

| Shop role | Access |
| --- | --- |
| `MANAGER` | View the shop and manage staff permissions |
| `TELESALE` | View assigned orders and related customers; requires a Pancake staff mapping |
| `VIEWER` | Read shop data |

The server checks shop permissions for lists, details, purchase history, and reports.
Reports use synchronized records and group amounts by currency.
Partial imports produce partial reports.
Read the [operations guide](./docs/pancake-rebuild.md) for the current amount convention and reconciliation limits.

## Read-only MCP

The MCP server uses stdio and reads the synchronized PostgreSQL data.
It checks the configured CRM account and current shop permissions on each call.

Set `PANCAKE_MCP_USER_EMAIL` to an existing, permitted CRM account.
Start the server from your MCP client with:

```sh
bun run pancake:mcp
```

Tools cover shops, orders, customers, purchase history, sales reports, operations, and CRM tasks.
The server provides no POS write tools.
See the [MCP guide](./docs/pancake-rebuild.md#mcp) for the tool list and client setup.

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/app` | Next.js web app and shop workspaces |
| `apps/api` | NestJS API, authentication, and tRPC routers |
| `apps/pancake-sync` | Pancake synchronization worker |
| `apps/pancake-mcp` | Local read-only MCP server |
| `apps/agent` | Optional research agent built with eve |
| `packages/pancake` | POS client, synchronization, queries, and permissions |
| `packages/db` | Prisma schema, migrations, and PostgreSQL client |
| `packages/auth` | Authentication and sign-in rules |
| `packages/ui` | Shared UI components and themes |
| `scripts/windows` | Windows startup and shutdown scripts |

## Checks

```sh
bun run check-types
bun run lint
bun run lint:slop
bun run test
bun run pancake:test
```

Database tests require an isolated `TEST_DATABASE_URL` and applied test migrations.
Use `bun run db:test` to prepare that database.

## Documentation

- [Windows deployment and POS integration](./docs/pancake-windows.md)
- [Operations, tasks, and MCP](./docs/pancake-rebuild.md)
- [Shop workspace handoff and remaining work](./docs/shop-workspaces-handoff.md)
- [Pancake integration audit](./docs/pancake-audit.md)
- [Local development](./docs/setup.md)
- [Environment settings](./docs/environment.md)
- [Agent architecture](./docs/agent.md)
- [Upstream contribution conventions](./CONTRIBUTING.md)

## Issues

1. NOT DONE — Shop record creation forms lack backend connections, including leads, appointments, and tickets.
   Fix: add models and API procedures, then connect the forms.
2. NOT DONE — Several shop settings and automation controls have no persistence.
   Fix: connect these controls to backend services.
3. NOT DONE — Several advanced filters and report breakdowns have no backend implementation.
   Fix: complete queries listed in the workspace handoff.
4. RISK — Incomplete synchronization and unreconciled amount conventions limit report accuracy.
   Fix: complete historical imports and reconcile reports with each shop.
5. NOT DONE — Shop date presets use UTC+07:00 across shops.
   Fix: apply the configured timezone for each shop.

## License and attribution

[MIT](./LICENSE). The upstream license and Comp AI copyright remain in this repository.
This fork adds the Pancake POS integration and shop workspaces.

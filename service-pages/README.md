# Service Pages Workspace

Standalone service coming-soon projects for The Indian Bar Company.
Each folder is now self-contained so it can be deployed on its own domain.

## Projects

- `martini`
- `negroni`
- `cosmopolitan`
- `bloody-mary`
- `rocket-fuel`

## Suggested dev ports

- `martini`: `3101`
- `negroni`: `3102`
- `cosmopolitan`: `3103`
- `bloody-mary`: `3104`
- `rocket-fuel`: `3105`

## Setup

From `service-pages/`:

```bash
npm install
```

Then run one app at a time:

```bash
npm run dev:martini
```

The current scaffold is intentionally minimal so each project is configured and ready for the full design pass.

## Independent Hosting

Each project has its own:

- `package.json`
- `tsconfig.json`
- `next.config.ts`
- `postcss.config.mjs`
- `eslint.config.mjs`

That means you can deploy each folder separately on different domains, for example:

- `martini.yourdomain.com`
- `negroni.yourdomain.com`
- `cosmopolitan.yourdomain.com`
- `bloodymary.yourdomain.com`
- `rocketfuel.yourdomain.com`

The actual domain connection will still be done in your hosting provider dashboard.

# Krishi Bandu

An agriculture marketplace and support platform connecting farmers, buyers, and admins.

## Architecture

- `client/` — React 18 + Vite frontend, React Router, Tailwind CSS
- `server/` — Node.js + Express backend, MongoDB Atlas via Mongoose
- Authentication: custom email/password auth using bcrypt + JWT (no third-party auth provider)

```
client/  React app (Vite dev server on :5173)
server/  Express API (on :5050)
```

## Authentication architecture

Krishi Bandu uses **stateless Bearer JWT authentication**, not HTTP-only cookies.

- On register/login, the server returns a signed JWT (`server/src/utils/jwt.js`) and a safe user object.
- The client stores the token in `localStorage` (`client/src/api/client.js`) and attaches it as
  `Authorization: Bearer <token>` on every request via an axios interceptor.
- `AuthContext` (`client/src/context/AuthContext.jsx`) restores the session on load by calling
  `GET /api/auth/me` with the stored token, and clears it if the token is invalid or expired.
- `server/src/middleware/auth.js` (`requireAuth`) verifies the JWT, loads the current user from
  MongoDB on every request, and rejects missing/invalid/expired tokens or suspended accounts.
- `requireRole(...)` enforces role-based authorization (`buyer`, `farmer`, `admin`, etc.) on the backend —
  the frontend's `ProtectedRoute` component mirrors this for UX but is never the source of truth.

**Why Bearer tokens instead of HTTP-only cookies:** the existing app already used bearer tokens and a
single-origin-in-dev / configurable-origin-in-prod deployment split across separate static (frontend)
and Node (backend) hosts. Cookie-based auth would require first-party cookie domains, CSRF protection,
and `SameSite`/`credentials` wiring across two independently deployed hosts. Continuing with bearer
tokens kept one complete, consistent architecture without partially mixing storage strategies.

**Known limitation:** a token in `localStorage` is readable by any JavaScript running on the page, so an
XSS vulnerability could exfiltrate it. Mitigations in place: strict `helmet` headers, no `dangerouslySetInnerHTML`
usage, and a short (7 day) token expiry. If this app moves to a single first-party domain in front of
both frontend and backend, switching to HTTP-only cookies would be the natural next hardening step.

### Auth endpoints

| Method | Path | Auth required | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create an account, returns `{ token, user }` |
| POST | `/api/auth/login` | No | Returns `{ token, user }` |
| GET | `/api/auth/me` | Yes | Returns the current authenticated user |
| PUT | `/api/auth/me` | Yes | Updates `name`, `phone`, `location`, `avatarUrl` only |
| POST | `/api/auth/change-password` | Yes | Requires `currentPassword` + `newPassword` |
| GET | `/api/health` | No | Basic liveness/DB-connection status |

Registration and login are rate-limited (20 requests / 15 minutes per IP) to slow down brute-force attempts.

## Local setup

### Prerequisites

- Node.js 18+
- A MongoDB Atlas connection string (or local MongoDB instance)

### Server

```bash
cd server
npm install
cp .env.example .env   # then fill in real values
npm run dev             # http://localhost:5050
```

### Client

```bash
cd client
npm install
cp .env.example .env   # defaults are fine for local dev
npm run dev             # http://localhost:5173
```

## Environment variables

### `server/.env`

```env
NODE_ENV=development
PORT=5050
MONGODB_URI=mongodb+srv://username:password@cluster.example.mongodb.net/krishibandu
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5173
BCRYPT_SALT_ROUNDS=12
```

The server refuses to start if `MONGODB_URI` or `JWT_SECRET` is missing, or if `JWT_SECRET` is too short.
`CLIENT_ORIGIN` accepts a comma-separated list of origins if you need to allow more than one frontend host.

### `client/.env`

```env
VITE_API_URL=http://localhost:5050/api
```

Only variables prefixed `VITE_` are exposed to the browser bundle — never put secrets (JWT secrets,
database credentials) in this file.

## Testing

```bash
# Backend (vitest + supertest + in-memory MongoDB)
cd server && npm test

# Frontend (vitest + Testing Library)
cd client && npm test
```

Backend tests cover registration, duplicate email conflicts, invalid input, login, invalid credentials,
protected-route token handling, `/auth/me`, profile-update field whitelisting, password change, suspended
accounts, and role-based authorization (buyer vs admin). Frontend tests cover `AuthContext` session
restoration/login/logout and `ProtectedRoute` loading/redirect/role behavior.

## Production build

```bash
cd client && npm run build   # outputs to client/dist
cd server && npm start        # NODE_ENV=production node src/index.js
```

`client/dist` is a static SPA build — deploy it to any static host (Cloudflare Pages, Netlify, etc.) with
SPA fallback routing enabled (unknown paths should serve `index.html` so React Router can handle them).

## Deployment environment variables

**Backend** (Render/Railway/Fly.io/etc.):

- `NODE_ENV=production`
- `PORT` — usually provided by the host automatically
- `MONGODB_URI` — your Atlas connection string
- `JWT_SECRET` — a long random string, different from development
- `JWT_EXPIRES_IN`
- `CLIENT_ORIGIN` — your deployed frontend URL(s), comma-separated if more than one
- `BCRYPT_SALT_ROUNDS`

**Frontend** (Cloudflare Pages/Netlify/etc.):

- `VITE_API_URL` — your deployed backend's `/api` URL

The backend binds to `process.env.PORT` and validates required env vars at startup, so no source changes
are needed between environments — only environment variables.

## Clerk removal

This project previously used [Clerk](https://clerk.com) for authentication alongside a partially-built
custom JWT backend, which caused users to be redirected to the wrong page after signup/login (Clerk's
`ClerkProvider` had hardcoded fallback redirect URLs that didn't reflect the user's actual role, since the
role was only known after an async sync call completed). Clerk has been fully removed:

- `@clerk/react` and `@clerk/express` removed from `client/package.json` and `server/package.json`
- `ClerkProvider`, `SignIn`, `SignUp`, `SignInButton`, `SignUpButton`, `UserButton`, `useClerkAuth`, `useUser`,
  `clerkMiddleware`, `getAuth` all removed
- `POST /api/auth/sync-clerk` route and `syncClerk` controller removed
- `clerkUserId` field removed from the `User` model
- All Clerk environment variables removed from `.env`/`.env.example` files

The app now uses a single, consistent authentication system: custom Express + MongoDB + JWT on the backend,
and a React `AuthContext` + `ProtectedRoute` on the frontend.

## Troubleshooting

**"Missing required environment variables" on server startup** — set `MONGODB_URI` and `JWT_SECRET` in
`server/.env`. The server intentionally refuses to start without them.

**401 on every request after login** — check that `client/.env`'s `VITE_API_URL` matches the running
backend, and that the browser's `localStorage` actually contains a `kb_token` value (DevTools → Application → Local Storage).

**CORS errors in the browser console** — `CLIENT_ORIGIN` in `server/.env` must exactly match the frontend's
origin (protocol + host + port), e.g. `http://localhost:5173`.

**Redirected to the wrong dashboard after login** — this was the original Clerk bug; it should no longer
occur. If it recurs, check `client/src/utils/roleRedirect.js` and `client/src/pages/public/Login.jsx`'s
redirect logic against the user's actual `role`.

**429 "Too many attempts" while testing locally** — the auth rate limiter caps register/login/change-password
at 20 requests per 15 minutes per IP. Wait, or restart the server to reset the in-memory limiter.


https://github.com/milan-sharma2004/Krishi-Bandu/pull/new/aditya/listings-dashboard-and-admin-tools
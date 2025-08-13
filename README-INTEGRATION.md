Integration with external backend (Replit)
==========================================

1. Create `.env.local` at project root and set:
   NEXT_PUBLIC_API_URL=https://pixel-backend.username.repl.co

2. The following pages were updated to use the external API:
   - pages/auth/signin.js -> POST /auth/login (stores localStorage 'pixel_auth_token')
   - pages/auth/signup.js -> POST /auth/register then /auth/login
   - pages/game.js -> GET /pixels, POST /pixels/buy (uses Bearer token)

3. You can delete or ignore Next.js API routes in `pages/api/*`.

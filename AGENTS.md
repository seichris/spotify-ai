# Repository Guidelines

## Project Structure & Module Organization
- `src/app` holds the Next.js App Router entry points (for example, `page.tsx`, `layout.tsx`) plus route handlers under `src/app/api` and UI routes like `src/app/login`.
- `src/components` and `src/components/ui` contain shared UI building blocks (PascalCase files like `Dashboard.tsx`, `Button.tsx`).
- `src/hooks`, `src/lib`, and `src/types` are for reusable logic, helpers, and shared TypeScript types.
- `src/auth.ts` centralizes NextAuth configuration.
- `public` stores static assets served at the site root.
- `spotify-web-api-endpoints` is a local reference file for Spotify API endpoints and deprecations.

## Build, Test, and Development Commands
- `npm run dev`: start the local Next.js dev server at `http://localhost:3000`.
- `npm run build`: create a production build (use before deploying).
- `npm run start`: run the production server after a build.
- `npm run lint`: run ESLint with the Next.js + TypeScript config.

## Coding Style & Naming Conventions
- TypeScript + React (Next.js 16). Keep files in `src/**` and prefer colocated modules over deep nesting.
- Follow existing formatting: 2-space indentation, double quotes, semicolons, and sorted imports where practical.
- Components use PascalCase filenames (`PlayerProvider.tsx`); route files follow Next.js conventions (`page.tsx`, `layout.tsx`).
- Styling uses Tailwind (`src/app/globals.css`) with `clsx`/`tailwind-merge` for class composition.

## Testing Guidelines
- No test runner is configured yet. For now, use `npm run lint` and `npm run build` as the primary checks.
- If you add tests, stick to `*.test.ts(x)` or `__tests__` conventions and document the new script in `package.json`.

## Commit & Pull Request Guidelines
- Recent commit messages are short and sentence-style (for example, “build recommender app”). Keep subjects concise and action-oriented.
- PRs should include: a clear summary, testing steps run, and screenshots or clips for UI changes.
- Link relevant issues when available and call out any API or auth changes explicitly.

## Configuration & Secrets
- Copy `.env.example` to `.env.local` and fill in Spotify, Gemini, and NextAuth secrets.
- Never commit real credentials; use placeholder values in docs and examples.

## External Dashboards
- Spotify Developer Dashboard: https://developer.spotify.com/dashboard

# PadhLo With Us: frontend rules for AI assistants

Product: roadmap-first learning platform for Indian CS/IT students and early-career devs.
A learner types a goal and gets a roadmap.sh-style roadmap with free resources.

## Stack (do not change)
- TanStack Start + TanStack Router (file routes in `src/routes`). Never add React Router.
- React 19, TypeScript (strict, `exactOptionalPropertyTypes`), Tailwind v4, shadcn/ui, lucide-react.
- React Query for data. React Flow is `@xyflow/react` (v12), not `reactflow`.
- Package manager: bun (`bun install`, `bun run dev`, `bun run test`).

## Data rules
- Components never import `src/lib/mock-data.ts`. Data goes through hooks in `src/lib/queries.ts`,
  which call `src/lib/api.ts`. Later `api.ts` switches to fetch calls to a FastAPI backend.
- Types in `src/lib/types.ts` use snake_case to match the API. Don't rename fields.
- No Supabase, no auth libraries, no env vars, no backend code in this repo.

## UI rules
- Mobile-first: test at 375px and 1280px.
- Every data screen has loading (Skeleton), empty, and error (with retry) states.
- Render user- or AI-provided text as plain text. Never use `dangerouslySetInnerHTML`.
- Colours: `primary` (indigo), `warning` (amber, CTAs/progress), `success` (green, done).
  Amber CTA = `bg-warning text-foreground hover:bg-warning/90`.
- Never invent statistics, user counts, testimonials or logos.
- Route head tags: use `pageMeta(title, description)` from `src/lib/seo.ts`.

## File routing gotcha
A route with children must use an `index` file: `roadmaps.index.tsx` + `roadmaps.$slug.index.tsx`,
not `roadmaps.tsx`, otherwise the parent swallows its children (it would need an `<Outlet />`).

## Before committing
`bun run lint && bun run test && bun run build` must pass.

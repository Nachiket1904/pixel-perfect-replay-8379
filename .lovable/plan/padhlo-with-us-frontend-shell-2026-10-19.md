# PadhLo With Us frontend shell

## Build
- Create a mobile-first shared header and footer with the requested navigation and a simple starting screen.
- Add the requested TypeScript models, mock records, and async API functions with the specified delays and generation behavior.
- Add placeholder pages for all requested URLs, including dynamic roadmap and paper paths and a not-found page.
- Apply the requested light palette and typography through the global design tokens.

## Technical notes
- Keep the app on TanStack Start and TanStack Router, which are already part of this project; do not add React Router or backend services.
- Keep mock data imported only by `src/lib/api.ts` and use the provided snake_case model fields.
- Verify routes and data rules using the project’s existing test setup and preview checks.
<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Use TanStack Start and TanStack Router for all pages because this repository is built on that stack; do not add React Router.
- Keep all application data access in `src/lib/api.ts`, with mock records isolated in `src/lib/mock-data.ts`, because the data layer is designed to be replaced by the user's FastAPI service later.
- Keep this frontend-only: do not add authentication, backend services, environment variables, or database integrations because the user provides their own FastAPI backend.

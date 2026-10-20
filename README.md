# Pixel Perfect Replay

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2ec6b5c3-3a27-48f6-a0e7-5cf199ca008e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? Install [Bun](https://bun.sh/), then run:

```sh
git clone <this-repository-url>
cd <repository-name>
bun install
bun run dev
```

## Deploy on Render

Deploy this app as a **Web Service** (not a Static Site):

1. In Render, choose **New > Web Service** and connect this repository.
2. Set the runtime to **Node** and use the repository root as the root directory.
3. Set the build command to `bun install --frozen-lockfile && bun run build`.
4. Set the start command to `node .output/server/index.mjs`.
5. Create the service. No publish directory or environment variables are needed for the current mock-data app.

The production build uses Nitro's Node server preset so it can run on Render.

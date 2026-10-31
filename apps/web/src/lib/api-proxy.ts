// Server-only. Forwards /api/* from the web app to FastAPI (API_ORIGIN), so the browser only
// ever talks to one origin. That keeps auth cookies first-party (SameSite=Lax works, no
// third-party-cookie problems on Safari) and means the API needs no public CORS for the web app.

// Hop-by-hop and length headers must not be copied between connections.
const DROP_REQUEST_HEADERS = [
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "te",
  "trailer",
  "host",
  "content-length",
];
const DROP_RESPONSE_HEADERS = ["connection", "keep-alive", "transfer-encoding", "content-length"];

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { code: "SERVER_ERROR", message, details: null } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function isApiRequest(request: Request): boolean {
  return new URL(request.url).pathname.startsWith("/api/");
}

export async function proxyToApi(request: Request): Promise<Response> {
  const apiOrigin = process.env["API_ORIGIN"];
  if (!apiOrigin) return errorResponse(503, "The API is not configured.");

  const incoming = new URL(request.url);
  // pathname always starts with "/api/", so it can't be turned into another host.
  const target = new URL(`${incoming.pathname}${incoming.search}`, apiOrigin);

  const headers = new Headers(request.headers);
  for (const name of DROP_REQUEST_HEADERS) headers.delete(name);
  // Ask for an uncompressed body so we can stream it straight back without re-encoding.
  headers.set("accept-encoding", "identity");
  const publicHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (publicHost) headers.set("x-forwarded-host", publicHost);
  if (!headers.has("x-forwarded-proto"))
    headers.set("x-forwarded-proto", incoming.protocol.slice(0, -1));

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, init);
    const responseHeaders = new Headers(upstream.headers); // keeps every Set-Cookie header
    for (const name of DROP_RESPONSE_HEADERS) responseHeaders.delete(name);
    responseHeaders.delete("content-encoding");
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("API proxy error", error);
    return errorResponse(502, "Can't reach the PadhLo API right now. Please try again.");
  }
}

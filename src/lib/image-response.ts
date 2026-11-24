// The answers the QR and receipt routes give. Every refusal is the same 404 (a missing file, a
// missing account and "not yours" look identical), and a found image is never cached or sniffed.
// The route streams the bytes itself: it never redirects to the Blob address.

const PRIVATE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export function notFoundResponse(): Response {
  return new Response("Not found", { status: 404, headers: PRIVATE });
}

export function imageResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: { ...PRIVATE, "Content-Type": "image/jpeg", "Content-Disposition": "inline" },
  });
}

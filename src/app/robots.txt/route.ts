export async function GET() {
  return new Response(
    "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /health\n",
    { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}

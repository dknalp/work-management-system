export const dynamic = "force-dynamic"

export function GET() {
  return Response.json({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "(not set)",
    NEXT_PUBLIC_MOCK_AUTH: process.env.NEXT_PUBLIC_MOCK_AUTH ?? "(not set)",
    NODE_ENV: process.env.NODE_ENV,
  })
}
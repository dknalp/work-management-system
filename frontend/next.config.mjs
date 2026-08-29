/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    experimental: {
        serverActions: {
            bodySizeLimit: "2gb",
        },
    },
        eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    /**
     * Proxy all backend requests through Next.js so the browser never needs to
     * know the backend's internal address.  In production (Dokploy), the
     * frontend and backend run as separate containers in the same compose network.
     * BACKEND_INTERNAL_URL defaults to http://backend:3052 (compose service name).
     */
    async rewrites() {
        const backendUrl =
            process.env.BACKEND_INTERNAL_URL ?? "http://backend:3052"
        // Proxy both the /api/* routes (v1 + new) and all legacy backend routes
        // that don't carry the /api prefix.  The frontend never exposes these
        // paths itself, so forwarding them to the backend is safe.
        const legacyPrefixes = [
            "auth", "users", "admin", "tasks", "activity", "team",
            "analytics", "permissions", "projects", "pipelines",
            "kanban", "calendar", "bots", "webhooks", "presence",
        ]
        const legacyRewrites = legacyPrefixes.map((prefix) => ({
            source: `/${prefix}/:path*`,
            destination: `${backendUrl}/${prefix}/:path*`,
        }))
        return [
            // /api/v1/me → backend:3052/api/v1/me (preserve the /api prefix)
            { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
            ...legacyRewrites,
        ]
    },
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    {
                        key: "Strict-Transport-Security",
                        value: "max-age=63072000; includeSubDomains; preload",
                    },
                    {
                        key: "Permissions-Policy",
                        value: "geolocation=(), camera=(), microphone=()",
                    },
                ],
            },
        ]
    },
}

export default nextConfig
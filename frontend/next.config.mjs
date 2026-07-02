/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    experimental: {
        serverActions: {
            bodySizeLimit: "2gb",
        },
    },
}

export default nextConfig

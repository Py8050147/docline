/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        ignoreBuildErrors: true
    },
    experimental: {
        serverComponentsHmrCache: false, // defaults to true\
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "img.clerk.com",
            },
        ],
    },
};

export default nextConfig;

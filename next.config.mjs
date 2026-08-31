/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
     // options
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

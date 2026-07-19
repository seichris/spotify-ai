import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      {
        hostname: "i.scdn.co",
        pathname: "/image/**",
        protocol: "https",
      },
    ],
  },
};

export default nextConfig;

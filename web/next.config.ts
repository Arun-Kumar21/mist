import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mist-s3-bucket.s3.ap-south-1.amazonaws.com",
        pathname: "/banners/**",
      },
      {
        protocol: "https",
        hostname: "mist-s3-bucket.s3.ap-southeast-1.amazonaws.com",
        pathname: "/banners/**",
      },
      {
        protocol: "https",
        hostname: "mist-s3-bucket.s3.amazonaws.com",
        pathname: "/banners/**",
      },
    ]
  }
};

export default nextConfig;

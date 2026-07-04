/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // for document uploads
    },
    // Puppeteer / Chromium must be excluded from bundling so the serverless
    // function stays small (bundling full Chromium makes /api/pdf 404 on deploy).
    // (Next 14 key; renamed to top-level `serverExternalPackages` in Next 15)
    serverComponentsExternalPackages: ["puppeteer", "puppeteer-core", "@sparticuz/chromium"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/mydayone/**",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude puppeteer from client bundle
      config.externals = [...(config.externals || []), "puppeteer"];
    }
    return config;
  },
};

export default nextConfig;
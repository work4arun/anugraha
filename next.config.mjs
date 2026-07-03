/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // for document uploads
    },
    // Puppeteer requires certain modules to be excluded from bundling
    // (Next 14 key; renamed to top-level `serverExternalPackages` in Next 15)
    serverComponentsExternalPackages: ["puppeteer", "puppeteer-core"],
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

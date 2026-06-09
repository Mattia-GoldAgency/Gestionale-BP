import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // RNP e minute possono pesare alcuni MB: alziamo il limite del body
      // delle Server Action (default 1MB) per consentirne l'upload.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;

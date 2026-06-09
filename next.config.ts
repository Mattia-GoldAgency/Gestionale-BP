import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // RNP e minute possono pesare alcuni MB: alziamo il limite del body
      // delle Server Action (default 1MB) per consentirne l'upload.
      bodySizeLimit: "20mb",
    },
  },
  images: {
    // I loghi dello Studio sono SVG locali e fidati.
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;

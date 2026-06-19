import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nessuna source map del bundle client in produzione: evita di esporre il
  // sorgente originale (è già il default di Next, qui reso esplicito).
  productionBrowserSourceMaps: false,
  experimental: {
    serverActions: {
      // RNP/minute e i documenti da tradurre (incl. scansioni) possono pesare
      // diversi MB: alziamo il limite del body delle Server Action (default 1MB).
      bodySizeLimit: "50mb",
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

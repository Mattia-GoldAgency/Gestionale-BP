import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import "./globals.css";

// Tipografia titoli del brand: Raleway SemiBold.
const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Atti di Mutuo — Studio Busani & Partners",
  description:
    "Generazione assistita degli atti di mutuo a partire da RNP e minuta bancaria.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${raleway.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

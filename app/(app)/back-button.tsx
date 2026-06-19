"use client";

import { useRouter, usePathname } from "next/navigation";

export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === "/dashboard") return null;

  return (
    <button 
      onClick={() => router.back()} 
      className="flex items-center text-sm font-medium text-gray-500 hover:text-[var(--brand-blue)] hover:underline mb-6 transition-colors w-fit"
    >
      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
      </svg>
      indietro
    </button>
  );
}

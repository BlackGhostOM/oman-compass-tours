import { Amiri, Cinzel, Cormorant_Garamond, Inter, Tajawal } from "next/font/google";

/* English */
export const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cinzel",
  display: "swap",
});

export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/* Arabic — `preload: false` so the font files are only fetched when the
   `ar` layout actually renders text with them. */
export const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
  preload: false,
});

export const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-tajawal",
  display: "swap",
  preload: false,
});

export const latinFontClasses = [cinzel.variable, cormorant.variable, inter.variable].join(" ");
export const arabicFontClasses = [amiri.variable, tajawal.variable].join(" ");

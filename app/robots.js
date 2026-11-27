import { PUBLIC_ORIGIN } from "../lib/public-origin";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: `${PUBLIC_ORIGIN}/sitemap.xml`,
  };
}

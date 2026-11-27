import { PUBLIC_ORIGIN } from "../lib/public-origin";

// Only public service pages belong here. Never include customer invitations.
export default function sitemap() {
  return ["/", "/templates", "/experience/wedding"].map((path) => ({
    url: path === "/" ? PUBLIC_ORIGIN : `${PUBLIC_ORIGIN}${path}`,
  }));
}

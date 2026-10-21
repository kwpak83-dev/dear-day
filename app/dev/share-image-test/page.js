import { notFound } from "next/navigation";
import ShareImageTest from "./share-image-test";

export default function Page() {
  if (process.env.NODE_ENV !== "development" || process.env.VERCEL) notFound();
  return <ShareImageTest />;
}

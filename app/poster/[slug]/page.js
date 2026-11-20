import PosterEditor from "../../../components/poster/poster-editor";
import "./poster.css";

export default async function PosterPage({ params }) {
  const { slug } = await params;
  return <PosterEditor key={slug} slug={slug} />;
}

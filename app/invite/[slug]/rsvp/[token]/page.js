import RsvpEditForm from "./rsvp-edit-form";

export default async function RsvpEditPage({ params }) {
  const { slug, token } = await params;
  return <RsvpEditForm slug={slug} token={token} />;
}
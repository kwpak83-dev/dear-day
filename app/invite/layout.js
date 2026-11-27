// Keep public invitation links shareable, but exclude personal content from search indexes.
export const metadata = {
  robots: { index: false },
};

export default function InvitationLayout({ children }) {
  return children;
}

"use client";

import ShareActions from "../../../components/share-actions";

export default function LinkCopy({ path, title }) {
  return <ShareActions path={path} title={title} className="public-share-copy" />;
}

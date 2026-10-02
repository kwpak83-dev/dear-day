"use client";

import ShareActions from "../../../components/share-actions";

export default function LinkCopy({ path, title, imageUrl = "" }) {
  return <div className="dd-public-share-section"><ShareActions path={path} title={title} imageUrl={imageUrl} className="public-share-copy" /></div>;
}

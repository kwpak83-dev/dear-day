"use client";

import ShareActions from "../../../components/share-actions";

export default function LinkCopy({ path, title, imageUrl = "", imageWidth, imageHeight }) {
  return <div className="dd-public-share-section"><ShareActions path={path} title={title} imageUrl={imageUrl} imageWidth={imageWidth} imageHeight={imageHeight} className="public-share-copy" /></div>;
}

"use client";

import ShareActions from "../../../components/share-actions";

export default function LinkCopy({ path, title, text, imageUnavailable, imageUrl = "", fallbackImageUrl = "", imageWidth, imageHeight }) {
  return <div className="dd-public-share-section"><ShareActions path={path} title={title} text={text} imageUnavailable={imageUnavailable} imageUrl={imageUrl} fallbackImageUrl={fallbackImageUrl} imageWidth={imageWidth} imageHeight={imageHeight} className="public-share-copy" /></div>;
}

"use client";

import { useEffect, useState } from "react";
import TemplateBgm from "./template-bgm";

// Resolve the shared catalog ID at playback time, without copying audio into a template.
export default function SharedTemplateBgm({ trackId }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let active = true;
    setUrl(null);
    if (!trackId) return () => { active = false; };
    fetch("/api/bgm").then(response => response.json()).then(data => {
      if (!active) return;
      const track = (data.tracks || []).find(item => item.id === trackId && item.isActive);
      setUrl(track?.url || null);
    }).catch(() => { if (active) setUrl(null); });
    return () => { active = false; };
  }, [trackId]);
  return <TemplateBgm src={url} />;
}

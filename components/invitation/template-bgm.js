"use client";

import { useEffect, useRef, useState } from "react";

export default function TemplateBgm({ src }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const audio = audioRef.current;
    setPlaying(false);
    setError("");
    return () => {
      if (!audio) return;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [src]);

  if (!src) return null;
  const play = async () => {
    setError("");
    try {
      await audioRef.current?.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
      setError("음악을 재생하지 못했어요.");
    }
  };
  const stop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setPlaying(false);
    setError("");
  };

  return <div className="dd-template-bgm" aria-label="배경 음악">
    <audio ref={audioRef} src={src} preload="none" onEnded={() => setPlaying(false)} />
    <button type="button" onClick={play} disabled={playing}>음악 재생</button>
    <button type="button" onClick={stop} disabled={!playing}>음악 정지</button>
    {error && <small role="status">{error}</small>}
  </div>;
}
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
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    return () => {
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
    };
  }, [src]);

  if (!src) return null;

  const play = async () => {
    setError("");
    try {
      if (audioRef.current?.ended) audioRef.current.currentTime = 0;
      await audioRef.current?.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
      setError("음악을 재생하지 못했어요.");
    }
  };

  const stop = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaying(false);
  };

  const toggle = () => {
    if (playing) {
      stop();
      return;
    }
    void play();
  };

  return <div className="dd-template-bgm" aria-label="배경 음악">
    <audio
      ref={audioRef}
      src={src}
      preload="none"
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={stop}
    />
    <button
      className="dd-template-bgm-toggle"
      type="button"
      onClick={toggle}
      aria-label={playing ? "음악 정지" : "음악 재생"}
      aria-pressed={playing}
      title={playing ? "음악 정지" : "음악 재생"}
    >
      <span aria-hidden="true">{playing ? "■" : "♪"}</span>
    </button>
    {error ? <small role="status">{error}</small> : null}
  </div>;
}

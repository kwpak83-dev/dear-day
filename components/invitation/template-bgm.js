"use client";

import { useEffect, useRef, useState } from "react";

function playbackErrorMessage(error, mediaError) {
  if (error?.name === "NotAllowedError") return "브라우저가 음악 재생을 허용하지 않았어요. 음표 버튼을 다시 눌러 주세요. (NotAllowedError)";
  if (mediaError?.code === 2) return "음원을 불러오지 못했어요. 네트워크 연결과 음원 주소를 확인해 주세요. (MEDIA_ERR_NETWORK)";
  if (mediaError?.code === 3) return "음원 파일을 해석하지 못했어요. 파일 상태를 확인해 주세요. (MEDIA_ERR_DECODE)";
  if (error?.name === "NotSupportedError" || mediaError?.code === 4) return "음원 주소에 접근할 수 없거나 지원하지 않는 형식이에요. (MEDIA_ERR_SRC_NOT_SUPPORTED)";
  if (error?.name === "AbortError" || mediaError?.code === 1) return "음악 재생이 중단됐어요. 다시 눌러 주세요. (AbortError)";
  return "음악을 재생하지 못했어요. 잠시 후 다시 눌러 주세요.";
}

export default function TemplateBgm({ src }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [showHint, setShowHint] = useState(false);
  const hintSeenRef = useRef(false);

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

  useEffect(() => {
    if (!src || hintSeenRef.current) return;
    hintSeenRef.current = true;
    const showTimer = window.setTimeout(() => setShowHint(true), 500);
    const hideTimer = window.setTimeout(() => setShowHint(false), 3500);
    return () => { window.clearTimeout(showTimer); window.clearTimeout(hideTimer); };
  }, [src]);

  if (!src) return null;

  const play = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setError("");
    try {
      if (audio.ended) audio.currentTime = 0;
      await audio.play();
      if (audio.getAttribute("src") !== src) return;
      setPlaying(true);
    } catch (error) {
      if (audio.getAttribute("src") !== src) return;
      setPlaying(false);
      setError(playbackErrorMessage(error, audio.error));
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
    setShowHint(false);
    if (playing) {
      stop();
      return;
    }
    void play();
  };

  return <div className="dd-template-bgm" aria-label="배경 음악">
    {showHint && <span className="dd-bgm-hint" aria-hidden="true">{playing ? "음악 ON" : "음악 켜기"} <span aria-hidden="true">→</span></span>}
    <audio
      ref={audioRef}
      src={src}
      preload="none"
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={stop}
      onError={(event) => {
        setPlaying(false);
        setError(playbackErrorMessage(null, event.currentTarget.error));
      }}
    />
    <button
      className="dd-template-bgm-toggle"
      type="button"
      onClick={toggle}
      aria-label={playing ? "음악 정지" : "음악 재생"}
      aria-pressed={playing}
      title={playing ? "음악 정지" : "음악 재생"}
    >
      <span className="dd-template-bgm-icon" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <path className="dd-template-bgm-note" d="M12 22.5V9.5l11-2v12" />
          <ellipse className="dd-template-bgm-note" cx="9.5" cy="23" rx="4" ry="3" />
          <ellipse className="dd-template-bgm-note" cx="20.5" cy="20" rx="4" ry="3" />
          {playing ? <path className="dd-template-bgm-wave" d="M25 10c2 2 2 5 0 7M28 7c4 4 4 10 0 14" /> : <path className="dd-template-bgm-off" d="M6 6l20 20" />}
        </svg>
      </span>
    </button>
    {error ? <small role="status">{error}</small> : null}
  </div>;
}

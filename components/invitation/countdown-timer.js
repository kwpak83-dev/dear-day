"use client";

import { useEffect, useState } from "react";

function remaining(target, now) {
  const milliseconds = Math.max(0, target - now);
  const seconds = Math.floor(milliseconds / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

export default function CountdownTimer({ targetDateTime, eventText }) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const target = new Date(targetDateTime).getTime();
  if (!Number.isFinite(target)) return null;
  const values = remaining(target, now ?? target);
  const finished = now !== null && now >= target;
  return <div className="classic-countdown" aria-label={eventText ? `${eventText}까지 남은 시간` : "행사까지 남은 시간"}>
    {eventText && <p className="classic-countdown-title">{eventText}까지</p>}
    <div className="classic-countdown-grid">
      {[
        ["Days", values.days],
        ["Hours", values.hours],
        ["Minutes", values.minutes],
        ["Seconds", values.seconds],
      ].map(([label, value]) => <div className="classic-countdown-unit" key={label}>
        <span className="classic-countdown-circle" suppressHydrationWarning>{label === "Days" ? value : String(value).padStart(2, "0")}</span>
        <span className="classic-countdown-label">{label}</span>
      </div>)}
    </div>
    {finished && <span className="classic-countdown-finished">행사 시간이 되었습니다.</span>}
  </div>;
}

"use client";

import { useEffect, useRef, useState } from "react";

let mapsSdkPromise;

function loadNaverMaps() {
  if (window.naver?.maps?.Service?.geocode) return Promise.resolve(window.naver.maps);
  if (mapsSdkPromise) return mapsSdkPromise;

  mapsSdkPromise = new Promise((resolve, reject) => {
    let settled = false;
    const startedAt = Date.now();
    const fail = () => {
      if (settled) return;
      settled = true;
      reject(new Error("Naver Maps SDK unavailable"));
    };
    const waitUntilReady = () => {
      if (settled) return;
      if (window.naver?.maps?.Service?.geocode) {
        settled = true;
        resolve(window.naver.maps);
        return;
      }
      if (Date.now() - startedAt >= 10000) return fail();
      window.setTimeout(waitUntilReady, 50);
    };

    const existing = document.getElementById("naver-map-sdk");
    if (existing) {
      existing.addEventListener("error", fail, { once: true });
      waitUntilReady();
      return;
    }

    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
    if (!clientId) return fail();
    const script = document.createElement("script");
    script.id = "naver-map-sdk";
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}&submodules=geocoder`;
    script.async = true;
    script.addEventListener("error", fail, { once: true });
    document.head.appendChild(script);
    waitUntilReady();
  }).catch((error) => {
    mapsSdkPromise = undefined;
    throw error;
  });

  return mapsSdkPromise;
}

export default function InvitationMap({ address, venue = "", onPositionChange }) {
  const canvasRef = useRef(null);
  const [position, setPosition] = useState(null);
  const normalizedAddress = address?.trim() || "";

  useEffect(() => {
    let active = true;
    setPosition(null);
    onPositionChange?.(null);
    if (!normalizedAddress) return () => { active = false; };

    loadNaverMaps().then((maps) => {
      maps.Service.geocode({ query: normalizedAddress }, (status, response) => {
        const result = response?.v2?.addresses?.[0];
        if (!active || status !== maps.Service.Status.OK || !result) return;
        const latitude = Number(result.y);
        const longitude = Number(result.x);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          const nextPosition = { latitude, longitude };
          setPosition(nextPosition);
          onPositionChange?.(nextPosition);
        }
      });
    }).catch(() => {});

    return () => { active = false; };
  }, [normalizedAddress, onPositionChange]);

  useEffect(() => {
    if (!position || !canvasRef.current || !window.naver?.maps) return;
    const maps = window.naver.maps;
    const point = new maps.LatLng(position.latitude, position.longitude);
    const map = new maps.Map(canvasRef.current, { center: point, zoom: 16, zoomControl: false });
    const marker = new maps.Marker({ position: point, map });
    maps.Event?.trigger(map, "resize");
    map.setCenter(point);

    return () => {
      marker.setMap(null);
      map.destroy?.();
    };
  }, [position]);

  if (!normalizedAddress || !position) return null;

  const destinationName = venue?.trim() || normalizedAddress;
  const encodedName = encodeURIComponent(destinationName);
  const { latitude, longitude } = position;
  const naverUrl = `https://map.naver.com/p/directions/-/-/-/car?c=${longitude},${latitude},15,0,0,0,dh`;
  const kakaoUrl = `https://map.kakao.com/link/to/${encodedName},${latitude},${longitude}`;
  const tmapUrl = `https://www.tmap.co.kr/tmap2/mobile/route.jsp?name=${encodedName}&lon=${longitude}&lat=${latitude}`;

  return <div className="invitation-map" aria-label={`${normalizedAddress} 지도`}>
    <div ref={canvasRef} className="invitation-map-canvas" />
    <nav className="invitation-navigation-links" aria-label="길찾기 앱 선택">
      <a href={naverUrl} target="_blank" rel="noreferrer"><span className="nav-app-icon naver" aria-hidden="true">N</span><span>네이버지도</span></a>
      <a href={kakaoUrl} target="_blank" rel="noreferrer"><span className="nav-app-icon kakao" aria-hidden="true">K</span><span>카카오맵</span></a>
      <a href={tmapUrl} target="_blank" rel="noreferrer"><span className="nav-app-icon tmap" aria-hidden="true">T</span><span>티맵</span></a>
    </nav>
  </div>;
}

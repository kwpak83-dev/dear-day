"use client";


import { useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/browser";


const templates = [
  { name: "Blossom", label: "로맨틱", color: "blossom", photo: "신랑 · 신부" },
  { name: "Mellow", label: "미니멀", color: "mellow", photo: "JIN & SEO" },
  { name: "Garden", label: "내추럴", color: "garden", photo: "Our day" },
];


function Heart({ className = "" }) {
  return <span className={`heart ${className}`}>♥</span>;
}


export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState("");


  const start = () => {
    setAuthOpen(true);
  };


  const chooseLogin = async (provider) => {
    if (provider === "naver") {
      setAuthLoading(provider);
      setAuthMessage("");
      window.location.assign("/api/auth/naver");
      return;
    }


    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthMessage("로그인 연결을 준비 중이에요. 잠시 후 다시 시도해주세요.");
      return;

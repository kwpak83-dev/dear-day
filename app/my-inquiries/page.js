"use client";

import { useEffect, useState } from "react";
import MyPageLayout from "../../components/my-page-layout";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";

const categoryOptions = [
  ["invitation", "초대장 이용"],
  ["payment", "결제 / 환불"],
  ["account", "계정"],
  ["issue", "오류 / 불편"],
  ["other", "기타"],
];
const categoryLabel = (value) => categoryOptions.find(([key]) => key === value)?.[1] || "기타";
const statusLabel = (value) => value === "answered" ? "답변완료" : "답변대기";
const formatDate = (value) => value && !Number.isNaN(new Date(value).getTime())
  ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(value)) : "-";

async function inquiryRequest(path, options = {}) {
  const supabase = getSupabaseBrowserClient();
  const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: {} };
  if (!session) {
    const error = new Error("로그인이 만료되었어요. 다시 로그인해 주세요.");
    error.status = 401;
    throw error;
  }
  const response = await fetch(path, {
    ...options,
    headers: { Authorization: `Bearer ${session.access_token}`, ...(options.body ? { "Content-Type": "application/json" } : {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || "문의를 처리하지 못했어요. 다시 시도해 주세요.");
    error.status = response.status;
    throw error;
  }
  return result;
}

export default function MyInquiries() {
  const [inquiries, setInquiries] = useState([]);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("list");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ category: "", title: "", content: "" });

  useEffect(() => {
    inquiryRequest("/api/inquiries")
      .then((result) => setInquiries(result.inquiries || []))
      .catch((error) => {
        if (error.status === 401) setLoginRequired(true);
        setNotice(error.message);
        setLoadFailed(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const openDetail = async (id) => {
    setNotice("");
    setDetailLoading(true);
    try {
      const result = await inquiryRequest(`/api/inquiries?id=${encodeURIComponent(id)}`);
      setSelected(result.inquiry);
      setView("detail");
    } catch (error) {
      if (error.status === 401) setLoginRequired(true);
      setNotice(error.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const title = form.title.trim();
    const content = form.content.trim();
    if (!form.category || !title || !content) return setNotice("문의 유형, 제목, 내용을 모두 입력해 주세요.");
    if (title.length > 100 || content.length > 2000) return setNotice("제목과 문의 내용의 글자 수를 확인해 주세요.");
    setSubmitting(true);
    setNotice("");
    try {
      const result = await inquiryRequest("/api/inquiries", {
        method: "POST",
        body: JSON.stringify({ category: form.category, title, content }),
      });
      setInquiries((current) => [result.inquiry, ...current]);
      setSelected(result.inquiry);
      setForm({ category: "", title: "", content: "" });
      setView("detail");
      setNotice("문의가 등록되었습니다.");
    } catch (error) {
      if (error.status === 401) setLoginRequired(true);
      setNotice(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return <MyPageLayout current="inquiries">
    <section className="my-content inquiries-content">
      <p className="section-kicker">INQUIRIES</p>
      <h1>문의내역</h1>
      <p className="my-intro">DearDay 이용 중 궁금한 점이나 불편한 사항을 문의해 주세요.</p>
      {notice && <div className="my-notice" role="status"><p>{notice}</p>{loginRequired && <a className="my-login-button" href="/?login=required&returnUrl=%2Fmy-inquiries">다시 로그인하기</a>}</div>}

      {!loginRequired && !loading && !loadFailed && view === "list" && <>
        <button type="button" className="inquiry-primary" onClick={() => { setNotice(""); setView("form"); }}>문의하기</button>
        {inquiries.length ? <div className="inquiry-list">{inquiries.map((inquiry) => <button type="button" key={inquiry.id} onClick={() => openDetail(inquiry.id)} disabled={detailLoading}>
          <span className="inquiry-category">{categoryLabel(inquiry.category)}</span>
          <strong>{inquiry.title}</strong>
          <span className="inquiry-meta"><time>{formatDate(inquiry.created_at)}</time><b>{statusLabel(inquiry.status)}</b></span>
        </button>)}</div> : <p className="inquiry-empty">아직 등록한 문의가 없습니다.</p>}
      </>}

      {!loginRequired && view === "form" && <form className="inquiry-form" onSubmit={submit}>
        <label>문의 유형<select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} required><option value="">선택해 주세요</option>{categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>제목<input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={100} required /></label>
        <label>문의 내용<textarea value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} maxLength={2000} rows={8} required /></label>
        <div className="inquiry-actions"><button type="button" onClick={() => { setNotice(""); setView("list"); }} disabled={submitting}>취소</button><button type="submit" className="inquiry-primary" disabled={submitting}>{submitting ? "등록 중..." : "문의 등록"}</button></div>
      </form>}

      {!loginRequired && view === "detail" && selected && <article className="inquiry-detail">
        <button type="button" className="inquiry-back" onClick={() => { setNotice(""); setView("list"); }}>← 문의내역으로</button>
        <span className="inquiry-category">{categoryLabel(selected.category)}</span>
        <h2>{selected.title}</h2>
        <div className="inquiry-meta"><time>{formatDate(selected.created_at)}</time><b>{statusLabel(selected.status)}</b></div>
        <p className="inquiry-body">{selected.content}</p>
        <section className="inquiry-replies"><h3>답변</h3>{selected.replies?.length ? selected.replies.map((reply) => <div key={reply.id}><time>{formatDate(reply.created_at)}</time><p>{reply.content}</p></div>) : <p>답변을 준비하고 있습니다.</p>}</section>
      </article>}
    </section>
  </MyPageLayout>;
}
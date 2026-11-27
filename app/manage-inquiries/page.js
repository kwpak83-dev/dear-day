"use client";

import { useEffect, useRef, useState } from "react";
import MyPageLayout from "../../components/my-page-layout";
import InquiryPhotos from "../../components/inquiry-photos";
import { inquiryRequest } from "../../lib/inquiry-browser";
import { inquiryCategory, inquiryDate, inquiryStatus } from "../../lib/inquiry-policy";

const endpoint = "/api/admin/inquiries";
const filters = [["all", "전체"], ["pending", "답변대기"], ["answered", "답변완료"]];
const detailRequest = id => inquiryRequest(`${endpoint}?id=${encodeURIComponent(id)}`);

export default function ManageInquiries() {
  const [list, setList] = useState(null);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const replyAttempt = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setNotice("");
    const params = new URLSearchParams({ status, page: String(page), search: submittedSearch });
    inquiryRequest(`${endpoint}?${params}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setList(result); })
      .catch(error => { if (!controller.signal.aborted) { setList(null); setNotice(error.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [status, page, submittedSearch, refresh]);

  const loadDetail = async id => {
    const result = await detailRequest(id);
    setSelected(result.inquiry);
  };
  const openDetail = async id => {
    if (lock.current) return;
    lock.current = true;
    setLoading(true);
    setNotice("");
    try { await loadDetail(id); setAnswer(""); replyAttempt.current = null; }
    catch (error) { setNotice(error.message); }
    finally { lock.current = false; setLoading(false); }
  };
  const submit = async event => {
    event.preventDefault();
    if (lock.current || !answer.trim()) return;
    lock.current = true;
    setPosting(true);
    setNotice("");
    const id = selected.id, content = answer.trim();
    const previous = replyAttempt.current;
    const replyId = previous?.id === id && previous.content === content ? previous.replyId : crypto.randomUUID();
    replyAttempt.current = { id, content, replyId };
    try {
      await inquiryRequest(endpoint, { method: "POST", body: JSON.stringify({ id, content, replyId }) });
      replyAttempt.current = null;
      setAnswer("");
      setRefresh(value => value + 1);
      try { await loadDetail(id); }
      catch { setSelected(null); }
    } catch (error) { setNotice(error.message); }
    finally { lock.current = false; setPosting(false); }
  };

  return <MyPageLayout current="manage-inquiries" inquiryRefresh={refresh}>
    <section className="my-content inquiries-content">
      <h1>고객 문의 관리</h1>
      {notice && <p className="my-notice" role="status">{notice}</p>}
      {loading && <p role="status">문의를 불러오는 중이에요.</p>}
      {list && !selected && <>
        <p className="inquiry-meta">전체 {list.pending + list.answered}건 · 답변대기 {list.pending}건 · 답변완료 {list.answered}건</p>
        <div className="inquiry-admin-controls">
          <div role="group" aria-label="답변 상태">
            {filters.map(([key, label]) => <button type="button" key={key} aria-pressed={status === key} disabled={loading} onClick={() => { setStatus(key); setPage(1); }}>{label}</button>)}
          </div>
          <form onSubmit={event => { event.preventDefault(); setPage(1); setSubmittedSearch(search.trim()); }}>
            <input aria-label="회원명 또는 문의 제목" placeholder="회원명 또는 문의 제목" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} />
            <button type="submit" disabled={loading}>검색</button>
          </form>
        </div>
        {list.inquiries.length ? <div className="inquiry-list">{list.inquiries.map(row => <button type="button" key={row.id} disabled={loading} onClick={() => openDetail(row.id)}>
          <span className="inquiry-category">{row.memberName} · {inquiryCategory(row.category)}</span>
          <strong>{row.title}</strong>
          <span className="inquiry-meta"><time>{inquiryDate(row.created_at)}</time><b>{inquiryStatus(row.status)}</b><span>첨부 {row.attachmentCount}장 · 상세보기</span></span>
        </button>)}</div> : <p className="inquiry-empty">해당 조건의 문의가 없습니다.</p>}
        <div className="inquiry-admin-controls">
          <button type="button" disabled={loading || page < 2} onClick={() => setPage(value => value - 1)}>이전</button>
          <span>{page} 페이지</span>
          <button type="button" disabled={loading || !list.hasMore} onClick={() => setPage(value => value + 1)}>다음</button>
        </div>
      </>}
      {selected && <article className="inquiry-detail">
        <button type="button" className="inquiry-back" disabled={posting} onClick={() => { setSelected(null); setNotice(""); }}>← 문의 목록으로</button>
        <span className="inquiry-category">{selected.memberName} · {inquiryCategory(selected.category)}</span>
        <h2>{selected.title}</h2>
        <div className="inquiry-meta"><time>{inquiryDate(selected.created_at)}</time><b>{inquiryStatus(selected.status)}</b></div>
        <p className="inquiry-body">{selected.content}</p>
        <InquiryPhotos key={selected.id} photos={selected.attachments} onRefresh={() => loadDetail(selected.id)} />
        <section className="inquiry-replies"><h3>답변 이력</h3>
          {selected.replies.length ? selected.replies.map(reply => <div key={reply.id}><time>{inquiryDate(reply.created_at)}</time><p>{reply.content}</p></div>) : <p>등록된 답변이 없습니다.</p>}
        </section>
        <form className="inquiry-form" onSubmit={submit}>
          <label>답변 입력<textarea rows={5} required maxLength={2000} disabled={posting} value={answer} onChange={event => setAnswer(event.target.value)} /></label>
          <div className="inquiry-actions"><button className="inquiry-primary" type="submit" disabled={posting || !answer.trim()}>{posting ? "등록 중..." : "답변 등록"}</button></div>
        </form>
      </article>}
    </section>
  </MyPageLayout>;
}

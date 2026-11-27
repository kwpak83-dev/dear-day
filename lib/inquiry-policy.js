export const INQUIRY_MAX_FILES = 3;
export const INQUIRY_MAX_ORIGINAL = 5 * 1024 * 1024;
export const INQUIRY_MAX_BYTES = 512000;
export const INQUIRY_MAX_SIDE = 1920;
export const inquiryTypes = [
  ["invitation", "초대장 이용"], ["payment", "결제 / 환불"], ["account", "계정"],
  ["issue", "오류 / 불편"], ["other", "기타"],
];
export const inquiryCategory = value => inquiryTypes.find(([key]) => key === value)?.[1] || "기타";
export const inquiryStatus = value => value === "answered" ? "답변완료" : "답변대기";
export const inquiryDate = value => value ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(value)) : "-";

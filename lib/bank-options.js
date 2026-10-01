export const BANK_OPTIONS = [
  { name: "국민은행", logo: "/banks/kb.png" },
  { name: "신한은행", logo: "/banks/shinhan.png" },
  { name: "하나은행", logo: "/banks/hana.png" },
  { name: "우리은행", logo: "/banks/woori.png" },
  { name: "농협은행", logo: "/banks/nh.png" },
  { name: "기업은행", logo: "/banks/ibk.png" },
  { name: "카카오뱅크", logo: "/banks/kakaobank.png" },
  { name: "케이뱅크", logo: "/banks/kbank.png" },
  { name: "SC제일은행", logo: "/banks/sc.png" },
  { name: "부산은행", logo: "/banks/busan.png" },
  { name: "새마을금고", logo: "/banks/mg.png" },
  { name: "iM뱅크", logo: "/banks/imbank.png" },
];

export function getBankLogo(bankName) {
  return BANK_OPTIONS.find((bank) => bank.name === bankName)?.logo || "";
}

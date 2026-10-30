export const EXPERIENCE_CHANNEL = "dearday-landing-experience";
export const EXPERIENCE_TEMPLATE_KEY = "cherry-blossom-day";
export const EXPERIENCE_FEATURES = [
  ["hero", "초대장 표지"], ["message", "인사말"], ["gallery", "갤러리"],
  ["program", "식순·일정"], ["location", "오시는 길"], ["rsvp", "참석 여부"],
  ["guestbook", "방명록"], ["accounts", "계좌정보"],
];
export const EXPERIENCE_TARGETS = {
  hero: "[data-share-hero]",
  message: ".classic-message, .modern-message, .romantic-message",
  gallery: ".invitation-gallery",
  location: ".classic-information, .modern-information, .romantic-information",
  accounts: ".public-accounts",
};
export const isExperienceFeature = value => EXPERIENCE_FEATURES.some(([key]) => key === value);

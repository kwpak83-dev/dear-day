// Curated, reusable font catalog for Hero text layers.
// Google Fonts are loaded only where the editor or renderer needs them.
export const HERO_FONTS = [
  { id: "noto-serif-kr", name: "Noto Serif KR", category: "한글 명조", family: '"Noto Serif KR", serif', sample: "우리의 소중한 순간" },
  { id: "nanum-myeongjo", name: "Nanum Myeongjo", category: "한글 명조", family: '"Nanum Myeongjo", serif', sample: "우리의 소중한 순간" },
  { id: "gowun-batang", name: "Gowun Batang", category: "한글 감성", family: '"Gowun Batang", serif', sample: "우리의 소중한 순간" },
  { id: "gowun-dodum", name: "Gowun Dodum", category: "한글 고딕", family: '"Gowun Dodum", sans-serif', sample: "우리의 소중한 순간" },
  { id: "noto-sans-kr", name: "Noto Sans KR", category: "한글 고딕", family: '"Noto Sans KR", sans-serif', sample: "우리의 소중한 순간" },
  { id: "playfair-display", name: "Playfair Display", category: "영문 세리프", family: '"Playfair Display", serif', sample: "Our Wedding Day" },
  { id: "cormorant-garamond", name: "Cormorant Garamond", category: "영문 세리프", family: '"Cormorant Garamond", serif', sample: "Our Wedding Day" },
  { id: "great-vibes", name: "Great Vibes", category: "영문 캘리그래피", family: '"Great Vibes", cursive', sample: "Happy Wedding Day" },
  { id: "allura", name: "Allura", category: "영문 캘리그래피", family: '"Allura", cursive', sample: "Happy Wedding Day" },
  { id: "alex-brush", name: "Alex Brush", category: "영문 캘리그래피", family: '"Alex Brush", cursive', sample: "Happy Wedding Day" },
  { id: "parisienne", name: "Parisienne", category: "영문 캘리그래피", family: '"Parisienne", cursive', sample: "Happy Wedding Day" },
  { id: "dancing-script", name: "Dancing Script", category: "영문 손글씨", family: '"Dancing Script", cursive', sample: "Happy Wedding Day" },
];
export const HERO_FONT_STYLESHEET = "https://fonts.googleapis.com/css2?family=Alex+Brush&family=Allura&family=Cormorant+Garamond:wght@400;500;600;700&family=Dancing+Script:wght@400;500;600;700&family=Gowun+Batang:wght@400;700&family=Gowun+Dodum&family=Great+Vibes&family=Nanum+Myeongjo:wght@400;700;800&family=Noto+Sans+KR:wght@400;500;600;700&family=Noto+Serif+KR:wght@400;500;600;700&family=Parisienne&family=Playfair+Display:wght@400;500;600;700&display=swap";
export const getHeroFont = (id) => HERO_FONTS.find((font) => font.id === id) || HERO_FONTS[0];

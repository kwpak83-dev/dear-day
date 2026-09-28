// CSS-only, repeatable background ornaments; no uploaded assets required.
export const BACKGROUND_PATTERN_GROUPS = [
  ["기본", [["dots","도트"],["grid","격자"],["diagonal","사선"],["stripes","세로 줄무늬"],["horizontal","가로 줄무늬"],["cross","교차"],["checker","체커"],["diamonds","다이아몬드"],["waves","물결"],["confetti","컨페티"]]],
  ["기하학", [["hexagons","육각형"],["triangles","삼각형"],["rings","동심원"],["arches","아치"]]],
  ["클래식", [["herringbone","헤링본"],["chevron","쉐브론"],["argyle","아가일"]]],
  ["로맨틱", [["hearts","작은 하트"],["stars","별"],["petals","꽃잎"]]],
  ["자연", [["leaves","잎사귀"],["flowers","꽃무늬"]]],
  ["감성", [["sketch","손그림 곡선"],["paper","종이 질감"],["sparkles","반짝이"]]],
];
export const BACKGROUND_PATTERN_KEYS = BACKGROUND_PATTERN_GROUPS.flatMap(([, entries]) => entries.map(([key]) => key));
export function backgroundPatternStyle(pattern, ink, size) {
  const s = Math.max(8, Math.min(80, Number(size) || 20));
  const px = `${s}px ${s}px`;
  const patterns = {
    dots: [`radial-gradient(circle, ${ink} 1.5px, transparent 2px)`,px],
    grid: [`linear-gradient(${ink} 1px, transparent 1px),linear-gradient(90deg,${ink} 1px,transparent 1px)`,px],
    diagonal: [`repeating-linear-gradient(45deg,transparent 0,transparent ${s-1}px,${ink} ${s-1}px,${ink} ${s}px)`,"auto"],
    stripes: [`repeating-linear-gradient(90deg,transparent 0,transparent ${s-1}px,${ink} ${s-1}px,${ink} ${s}px)`,"auto"],
    horizontal: [`repeating-linear-gradient(0deg,transparent 0,transparent ${s-1}px,${ink} ${s-1}px,${ink} ${s}px)`,"auto"],
    cross: [`linear-gradient(45deg,transparent 48%,${ink} 49%,${ink} 51%,transparent 52%),linear-gradient(-45deg,transparent 48%,${ink} 49%,${ink} 51%,transparent 52%)`,px],
    checker: [`conic-gradient(${ink} 25%,transparent 0 50%,${ink} 0 75%,transparent 0)`,px],
    diamonds: [`linear-gradient(45deg,transparent 45%,${ink} 46%,${ink} 48%,transparent 49%),linear-gradient(-45deg,transparent 45%,${ink} 46%,${ink} 48%,transparent 49%)`,px],
    waves: [`radial-gradient(ellipse at 50% 100%,transparent 55%,${ink} 58%,transparent 62%)`,px],
    confetti: [`radial-gradient(circle at 20% 25%,${ink} 2px,transparent 3px),radial-gradient(circle at 75% 70%,${ink} 1px,transparent 2px)`,px],
    hexagons: [`linear-gradient(30deg,${ink} 1px,transparent 1px),linear-gradient(150deg,${ink} 1px,transparent 1px),linear-gradient(90deg,${ink} 1px,transparent 1px)`,px],
    triangles: [`conic-gradient(from 150deg at 50% 70%,${ink} 60deg,transparent 0 300deg,${ink} 0)`,px],
    rings: [`repeating-radial-gradient(circle at center,transparent 0,transparent 4px,${ink} 5px,transparent 6px)`,px],
    arches: [`radial-gradient(ellipse at 50% 100%,transparent 55%,${ink} 57%,transparent 60%)`,px],
    herringbone: [`linear-gradient(135deg,${ink} 12%,transparent 12% 50%,${ink} 50% 62%,transparent 62%),linear-gradient(45deg,${ink} 12%,transparent 12% 50%,${ink} 50% 62%,transparent 62%)`,px],
    chevron: [`linear-gradient(135deg,${ink} 12%,transparent 12% 88%,${ink} 88%),linear-gradient(225deg,${ink} 12%,transparent 12% 88%,${ink} 88%)`,px],
    argyle: [`linear-gradient(45deg,transparent 47%,${ink} 48% 50%,transparent 51%),linear-gradient(-45deg,transparent 47%,${ink} 48% 50%,transparent 51%)`,px],
    hearts: [`radial-gradient(circle at 40% 37%,${ink} 3px,transparent 3.5px),radial-gradient(circle at 60% 37%,${ink} 3px,transparent 3.5px),conic-gradient(from 135deg at 50% 45%,transparent 90deg,${ink} 0 180deg,transparent 0)`,px],
    stars: [`linear-gradient(0deg,transparent 46%,${ink} 49% 51%,transparent 54%),linear-gradient(90deg,transparent 46%,${ink} 49% 51%,transparent 54%)`,px],
    petals: [`radial-gradient(ellipse at 40% 40%,${ink} 0 12%,transparent 13%),radial-gradient(ellipse at 60% 60%,${ink} 0 10%,transparent 11%)`,px],
    leaves: [`radial-gradient(ellipse at 35% 40%,${ink} 0 12%,transparent 13%),radial-gradient(ellipse at 65% 65%,${ink} 0 12%,transparent 13%),linear-gradient(45deg,transparent 49%,${ink} 50%,transparent 51%)`,px],
    flowers: [`radial-gradient(circle at 50% 35%,${ink} 0 9%,transparent 10%),radial-gradient(circle at 35% 50%,${ink} 0 9%,transparent 10%),radial-gradient(circle at 65% 50%,${ink} 0 9%,transparent 10%),radial-gradient(circle at 50% 65%,${ink} 0 9%,transparent 10%)`,px],
    sketch: [`radial-gradient(ellipse at 50% 100%,transparent 53%,${ink} 55%,transparent 58%),radial-gradient(ellipse at 20% 0%,transparent 55%,${ink} 57%,transparent 60%)`,px],
    paper: [`repeating-linear-gradient(35deg,transparent 0 3px,${ink} 3px 3.4px,transparent 3.4px 8px),repeating-linear-gradient(125deg,transparent 0 5px,${ink} 5px 5.3px,transparent 5.3px 11px)`,px],
    sparkles: [`radial-gradient(circle at 20% 20%,${ink} 1px,transparent 2px),radial-gradient(circle at 75% 60%,${ink} 2px,transparent 3px),linear-gradient(45deg,transparent 48%,${ink} 49% 51%,transparent 52%)`,px],
  };
  const [image, backgroundSize] = patterns[pattern] || patterns.dots;
  return { image, backgroundSize };
}

import { PROGRAM_ICON_IDS } from "../../lib/invitation-program";

// A single monochrome hand-drawn vocabulary shared by editor and published invitations.
// SVG paths are authored locally; no external assets or fonts are required.
const drawings = {
 rings:<><g transform="rotate(-13 18 27)"><ellipse cx="18" cy="28" rx="9.5" ry="10.5"/><ellipse cx="18" cy="28" rx="7.7" ry="8.7"/><path d="M11 23q7-4 14 0M13 34q5 3 10 0"/></g><g transform="rotate(13 30 27)"><ellipse cx="30" cy="28" rx="9.5" ry="10.5"/><ellipse cx="30" cy="28" rx="7.7" ry="8.7"/><path d="M23 23q7-4 14 0M25 34q5 3 10 0"/></g><path d="m12 15 6-7 6 7-6 3zM18 8v10M14 13h8m2-1 6-7 6 7-6 3zM30 5v10M26 10h8" strokeWidth=".85"/><path d="m7 8 2-3m31 0 2 3M24 2v3" strokeWidth=".65"/></>,
 dress:<><path d="M20 5q4 4 8 0l3 6-3 7 12 23q-16 6-32 0l12-23-3-7zM20 5l4 8 4-8M20 18q4 2 8 0M18 23q6 4 12 0M14 32q10 5 20 0M9 40q15 5 30 0"/><path d="M17 11l-6 8 5 4m15-12 6 8-5 4M16 28l-5 12m21-12 5 12M24 23v19M21 6q-4 1-5 4m11-4q4 1 5 4" strokeWidth=".7"/></>,
 suit:<><path d="M17 6q7 4 14 0l8 6 4 28-8 2-2-19-1 20H16l-1-20-2 19-8-2 4-28z"/><path d="M17 6l7 15 7-15M17 6l-5 9 8 10 4-4 4 4 8-10-5-9M24 21v22M20 12l4 5 4-5-4-3zM16 40l-1-17m18 0-1 17M18 32v9m12-9v9"/><path d="m12 15 5 2-3 3 6 7m16-12-5 2 3 3-6 7M28 30h4M24 27v.3m0 6v.3m0 6v.3" strokeWidth=".7"/></>,
 bouquet:<><path d="M15 22q6 11 10 20m8-20q-6 11-8 20M10 26q15 8 29 0M17 33q8 5 16 0M20 38l10-3M20 40l10-3"/><g strokeWidth=".95"><path d="M13 16q-7-7-1-12 6-3 9 4 2 6-4 10M30 9q1-10 8-6 7 7-3 13M21 8q-2-9 5-7 7 4 1 11M8 22q-9-3-5-9 5-5 11 2M36 20q7-10 11-3 3 8-9 9M17 24q-5-8 1-11 8-2 8 8M28 22q-1-10 6-10 8 4 1 12"/><circle cx="13" cy="12" r="2.5"/><circle cx="34" cy="10" r="2.5"/><circle cx="24" cy="8" r="2.5"/><circle cx="9" cy="19" r="2.2"/><circle cx="40" cy="21" r="2.2"/><circle cx="21" cy="20" r="2.5"/><circle cx="32" cy="20" r="2.5"/><path d="M15 24q-9 1-10 8 9 1 13-6m15 0q10-2 12 5-8 3-14-3M22 26q-5 5-3 10m8-10q7 4 5 10M11 11l-5-5m31 2 5-5m-19 3V2"/></g></>,
 flower:<><circle cx="24" cy="18" r="3.3"/><path d="M21 16q-13-10-12 1 2 8 12 4M24 14q-6-17 3-13 8 5 0 14M28 17q15-10 13 1-2 8-13 4M22 22q-13 9-5 14 8 3 9-13M27 22q12 10 4 14-8 2-8-12M24 22v23M24 32q-11-11-15-5 3 9 15 9m0 4q9-13 16-9-2 9-16 11"/><path d="M16 15l3 2m11-2-3 2m-8 11 3-3m8 3-3-3" strokeWidth=".65"/></>,
 cake:<><path d="M6 39q18 7 36 0M4 42q20 8 40 0M9 40V29q15 6 30 0v11M9 29q-3-4 0-6 14-6 30 0 3 2 0 6-15 7-30 0zM13 23v-9q11 5 22 0v9M13 14q-3-3 0-5 10-5 22 0 3 2 0 5-11 6-22 0z"/><path d="M10 32q3 6 6 0 3 6 6 0 3 6 6 0 3 6 6 0 3 6 5 0M14 17q3 4 5 0 3 4 5 0 3 4 5 0 3 4 5 0M20 9V4m8 5V4M18 4q-2-3 2-4 3 2 0 4m6 0q-2-3 2-4 3 2 0 4M6 45h36"/><path d="M13 36l2 2m4-3 2 2m4-2 2 2m4-2 2 2" strokeWidth=".6"/></>,
 champagne:<><g transform="rotate(-14 14 21)"><path d="M5 6h17l-2 13q-1 7-7 7t-7-7zM13 26v13M6 40h14M7 14q7 3 13 0M9 17q5 2 9 0"/><path d="M9 7l3-4m4 3 3-3" strokeWidth=".6"/></g><g transform="rotate(14 34 21)"><path d="M26 6h17l-2 13q-1 7-7 7t-7-7zM34 26v13M27 40h14M28 14q7 3 13 0M30 17q5 2 9 0"/><path d="M30 7l3-4m4 3 3-3" strokeWidth=".6"/></g><path d="m21 3 3-3 3 3M24 4v4m-4 0-3 2m14-2 3 2M23 45l1-2 1 2" strokeWidth=".8"/></>,
 camera:<><path d="M4 16h8l4-6h15l4 6h9v26H4zM7 16v-4h5M9 13h4M16 10l2-3h12l2 3M8 21h6M36 21h5M7 39h34M6 43h36"/><circle cx="25" cy="28" r="11"/><circle cx="25" cy="28" r="8"/><circle cx="25" cy="28" r="5"/><path d="M19 23q7-5 12 1M21 33q6 4 10-2M25 17v3m0 16v3m-11-11h3m16 0h3M38 12h4M7 18v2" strokeWidth=".75"/></>,
 microphone:<><rect x="18" y="4" width="12" height="25" rx="6"/><path d="M14 20q0 17 10 17t10-17M24 37v7m-9 0h18M19 11h10m-10 5h10m-10 5h10M21 6q3-2 6 0" strokeWidth=".95"/><path d="M17 30q-4-3-4-9m22 0q0 6-4 9" strokeWidth=".65"/></>,
 music:<><path d="M18 34V10l21-5v25M18 15l21-5M18 34q-8-5-12 2-3 8 6 8 6-1 6-10M39 30q-8-5-12 2-3 8 6 8 6-1 6-10"/><path d="M22 17v12m4-13v10M31 14v11" strokeWidth=".55"/></>,
 book:<><path d="M22 11Q12 3 3 9L2 36q12-4 22 8 9-12 22-8L45 9q-9-6-19 2l-2 33M22 11l2 33M4 37q11-3 20 7m21-7q-12-3-21 7"/><path d="M7 15q7-2 12 3M7 20q7-2 12 3M7 25q7-2 12 3M7 30q7-2 12 3m10-15q5-4 12-3m-12 8q5-4 12-3m-12 8q5-4 12-3" strokeWidth=".65"/><path d="M30 34 42 7l3-5 2 2-2 5-12 27-5 5zM42 7l3 2M30 34l3 2M28 41l2-7" strokeWidth="1"/><path d="M40 11l3 2" strokeWidth=".65"/></>,
 gift:<><path d="M8 20h32v22H8zM5 13h38v7H5zM24 13v29M9 24h30M11 37h26"/><path d="M24 13Q7 15 10 6q4-10 14 7 10-17 14-7 3 9-14 7M18 14q-5 7-9 7m21-7q5 7 9 7" strokeWidth=".85"/><path d="M14 28v8m20-8v8" strokeWidth=".6"/></>,
 balloons:<><path d="M15 3C2 3 3 21 15 28 27 21 28 3 15 3zM34 8C22 8 22 25 34 32 46 25 46 8 34 8zM12 28l3 4 3-4m13 4 3 4 3-4M15 32q-8 9 9 12 12 0 10-8"/><path d="M10 9q-4 5-2 10m22-5q-3 5-2 10" strokeWidth=".7"/></>,
 dining:<><circle cx="24" cy="24" r="14"/><circle cx="24" cy="24" r="10"/><circle cx="24" cy="24" r="7" strokeWidth=".65"/><path d="M5 7v34M2 7v12q3 3 6 0V7M43 7v34M43 7q-8 9 0 18M8 44h32"/><path d="M18 14q6-3 12 0" strokeWidth=".65"/></>,
 coffee:<><path d="M8 17h28v14q-1 11-14 11T8 31zM36 20q11-2 10 7-1 7-10 7M5 44h37M10 36q12 7 24 0"/><path d="M16 4q-7 6 0 11m9-12q-7 6 0 12m8-11q-6 6 0 11" strokeWidth=".85"/></>,
 crown:<><path d="m5 16 10 8 9-15 9 15 10-8-5 25H10zM10 35h28M12 39h24"/><circle cx="5" cy="14" r="2"/><circle cx="24" cy="7" r="2"/><circle cx="43" cy="14" r="2"/><path d="M17 30l7-6 7 6-7 6zM14 27l-3-4m26 0-3 4" strokeWidth=".75"/></>,
 star:<><path d="m24 4 6 13 14 2-10 10 3 15-13-7-13 7 3-15L4 19l14-2z"/><path d="m24 11 4 9 9 1-7 7 2 9-8-4-8 4 2-9-7-7 9-1z" strokeWidth=".7"/></>,
 heart:<><path d="M24 42 7 25Q-2 10 11 7q9-2 13 8 4-10 13-8 13 3 4 18z"/><path d="M24 37 11 24Q4 13 12 12q7-1 12 10 5-11 12-10 8 1 1 12z" strokeWidth=".65"/></>,
 ribbon:<><path d="M24 22Q4 4 6 18q2 13 18 4Q44 4 42 18q-2 13-18 4M24 22l-9 22-5-8-8 1 13-19m9 4 9 22 5-8 8 1-13-19"/><path d="M24 22q-9-8-13-6 1 7 13 6m0 0q9-8 13-6-1 7-13 6M16 30l-4 8m20-8 4 8" strokeWidth=".7"/></>,
 airplane:<><path d="m3 25 41-18-12 35-9-13-10 7 4-14zM17 22 44 7M23 29l-1 11"/><path d="m6 12 4-2m-5 8 3-1m30 25 4 2" strokeWidth=".7"/></>,
 church:<><path d="M8 43V20L24 7l16 13v23M5 43h38M16 43V28h16v15M24 7V1m-4 3h8M8 23h32M12 25v14m24-14v14"/><path d="M21 16h6v7h-6zM20 32q4-4 8 0" strokeWidth=".75"/></>,
 leaf:<><path d="M9 42Q1 10 41 5q-1 35-32 37M9 42Q23 19 41 5M18 29l-2-12m9 5 12 1M14 35l-8-3m24-17 3 8" strokeWidth=".95"/></>,
 tree:<><path d="M24 45V23M13 35Q1 31 7 19q-3-13 11-14 8-9 16 0 14 1 10 14 6 12-6 16zM24 31 13 21m11 6 10-11M24 37l-7-6m7 2 8-7"/><path d="M12 13q5-5 10-3m9-1q7 2 7 8M12 29q-4-3-3-8" strokeWidth=".7"/></>,
 clock:<><circle cx="24" cy="24" r="19"/><circle cx="24" cy="24" r="16.5" strokeWidth=".7"/><path d="M24 12v12l9 6M24 3v4m0 34v4M3 24h4m34 0h4M12 12l2 2m20-2-2 2M12 36l2-2m20 2-2-2" strokeWidth=".9"/><circle cx="24" cy="24" r="1.6"/></>,
 car:<><path d="M5 20h38v19H5zM10 20l6-11h16l6 11M9 39v5h8v-5m14 0v5h8v-5M8 28h8m16 0h8M18 20h12M9 34h30"/><path d="M13 17l4-6h14l4 6M6 24l-3-3m39 3 3-3M20 31h8" strokeWidth=".7"/></>
};
export const PROGRAM_ICON_CATEGORIES = [
 {id:"all",label:"전체"}, {id:"wedding",label:"웨딩"}, {id:"celebration",label:"축하"},
 {id:"general",label:"일반"}, {id:"dining",label:"식사"}, {id:"other",label:"기타"}
];
const groups = {wedding:["rings","dress","suit","bouquet","flower","book","church"],celebration:["cake","champagne","gift","balloons","crown","star","heart","ribbon"],general:["camera","microphone","music","clock","car","airplane"],dining:["dining","coffee"],other:["leaf","tree"]};
const names = ["반지","드레스","턱시도","부케","꽃","케이크","샴페인","카메라","마이크","음악","책/서약","선물","풍선","식기","커피","왕관","별","하트","리본","비행기","집/건물","나뭇잎","나무","시계","자동차"];
export const PROGRAM_ICONS = PROGRAM_ICON_IDS.map((id,i)=>({id,label:names[i],category:Object.keys(groups).find(group=>groups[group].includes(id))||"other"}));
export default function ProgramIcon({id,size=42,className=""}) {
 if(!drawings[id]) return null;
 return <svg className={className} width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{drawings[id]}</svg>;
}

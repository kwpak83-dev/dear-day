import { PROGRAM_ICON_IDS } from "../../lib/invitation-program";

// A single monochrome hand-drawn vocabulary shared by editor and published invitations.
// SVG paths are authored locally; no external assets or fonts are required.
const drawings = {
 rings:<><g transform="rotate(-12 17 27)"><ellipse cx="17" cy="27" rx="9" ry="10.5"/><ellipse cx="17" cy="27" rx="7.3" ry="8.7"/><path d="M10 21q7-5 14 0M11 34q6 4 12-1M12 17l2-4 6-1 4 5-7 3zM14 13l3-6 3 5M17 7l-4 6m4-6 5 6M12 17l5-2 7 2"/></g><g transform="rotate(12 31 27)"><ellipse cx="31" cy="27" rx="9" ry="10.5"/><ellipse cx="31" cy="27" rx="7.3" ry="8.7"/><path d="M24 21q7-5 14 0M25 34q6 4 12-1M26 17l2-4 6-1 4 5-7 3zM28 13l3-6 3 5M31 7l-4 6m4-6 5 6M26 17l5-2 7 2"/></g><path d="m6 9 2-3m33 1 2 3M24 3v3"/></>,
 dress:<><path d="M20 5q4 4 8 0l3 6-3 7 12 23q-16 6-32 0l12-23-3-7zM20 5l4 8 4-8M20 18q4 2 8 0M18 23q6 4 12 0M14 32q10 5 20 0M9 40q15 5 30 0"/><path d="M17 11l-6 8 5 4m15-12 6 8-5 4M16 28l-5 12m21-12 5 12M24 23v19M21 6q-4 1-5 4m11-4q4 1 5 4" strokeWidth=".7"/></>,
 suit:<><path d="M17 5q7 4 14 0l9 6 4 29-8 2-2-18-1 20H15l-1-20-2 18-8-2 4-29z"/><path d="m17 5-5 10 9 12 3-8 3 8 9-12-5-10-7 14zM17 5l7 14 7-14M21 12l3 4 3-4-3-3zM24 19v24M15 40l-1-15m20 0-1 15M18 32l-1 9m14-9 1 9"/><path d="m12 15 5 2-3 3 7 8m15-13-5 2 3 3-7 8M28 30h5m-9-6h.1m-.1 6h.1m-.1 6h.1M8 14l-2 19m34-19 2 19"/><path d="M10 11l4-4 3-2m21 6-4-4-3-2" strokeWidth=".6"/></>,
 bouquet:<><path d="M15 22q6 11 10 20m8-20q-6 11-8 20M10 26q15 8 29 0M17 33q8 5 16 0M20 38l10-3M20 40l10-3"/><g strokeWidth=".95"><path d="M13 16q-7-7-1-12 6-3 9 4 2 6-4 10M30 9q1-10 8-6 7 7-3 13M21 8q-2-9 5-7 7 4 1 11M8 22q-9-3-5-9 5-5 11 2M36 20q7-10 11-3 3 8-9 9M17 24q-5-8 1-11 8-2 8 8M28 22q-1-10 6-10 8 4 1 12"/><circle cx="13" cy="12" r="2.5"/><circle cx="34" cy="10" r="2.5"/><circle cx="24" cy="8" r="2.5"/><circle cx="9" cy="19" r="2.2"/><circle cx="40" cy="21" r="2.2"/><circle cx="21" cy="20" r="2.5"/><circle cx="32" cy="20" r="2.5"/><path d="M15 24q-9 1-10 8 9 1 13-6m15 0q10-2 12 5-8 3-14-3M22 26q-5 5-3 10m8-10q7 4 5 10M11 11l-5-5m31 2 5-5m-19 3V2"/></g></>,
 flower:<><circle cx="24" cy="17" r="4"/><path d="M24 13C13 0 10 16 20 17M28 17C42 9 33 0 24 13M24 21c-8 15-20 1-4-4M28 17c14 10 3 19-4 4M24 21v21M24 33l-10-6M24 36l10-7"/></>,
 cake:<><path d="M6 39q18 7 36 0M4 42q20 8 40 0M9 40V29q15 6 30 0v11M9 29q-3-4 0-6 14-6 30 0 3 2 0 6-15 7-30 0zM13 23v-9q11 5 22 0v9M13 14q-3-3 0-5 10-5 22 0 3 2 0 5-11 6-22 0z"/><path d="M10 32q3 6 6 0 3 6 6 0 3 6 6 0 3 6 6 0 3 6 5 0M14 17q3 4 5 0 3 4 5 0 3 4 5 0 3 4 5 0M20 9V4m8 5V4M18 4q-2-3 2-4 3 2 0 4m6 0q-2-3 2-4 3 2 0 4M6 45h36"/><path d="M13 36l2 2m4-3 2 2m4-2 2 2m4-2 2 2" strokeWidth=".6"/></>,
 champagne:<><g transform="rotate(-14 14 21)"><path d="M5 6h17l-2 13q-1 7-7 7t-7-7zM13 26v13M6 40h14M7 14q7 3 13 0M9 17q5 2 9 0"/><path d="M9 7l3-4m4 3 3-3" strokeWidth=".6"/></g><g transform="rotate(14 34 21)"><path d="M26 6h17l-2 13q-1 7-7 7t-7-7zM34 26v13M27 40h14M28 14q7 3 13 0M30 17q5 2 9 0"/><path d="M30 7l3-4m4 3 3-3" strokeWidth=".6"/></g><path d="m21 3 3-3 3 3M24 4v4m-4 0-3 2m14-2 3 2M23 45l1-2 1 2" strokeWidth=".8"/></>,
 camera:<><path d="M4 16h8l4-6h15l4 6h9v26H4zM7 16v-4h5M9 13h4M16 10l2-3h12l2 3M8 21h6M36 21h5M7 39h34M6 43h36"/><circle cx="25" cy="28" r="11"/><circle cx="25" cy="28" r="8"/><circle cx="25" cy="28" r="5"/><path d="M19 23q7-5 12 1M21 33q6 4 10-2M25 17v3m0 16v3m-11-11h3m16 0h3M38 12h4M7 18v2" strokeWidth=".75"/></>,
 microphone:<><rect x="18" y="5" width="12" height="24" rx="6"/><path d="M14 21q0 15 10 15t10-15M24 36v7m-8 0h16M20 13h8m-8 6h8"/></>,
 music:<><path d="M19 33V9l19-4v25M19 14l19-4M19 33q-8-5-12 1-4 8 5 8 7 0 7-9M38 30q-8-5-12 1-4 8 5 8 7 0 7-9"/></>,
 book:<><path d="M22 11Q12 3 3 9L2 36q12-4 22 8 9-12 22-8L45 9q-9-6-19 2l-2 33M22 11l2 33M4 37q11-3 20 7m21-7q-12-3-21 7"/><path d="M7 15q7-2 12 3M7 20q7-2 12 3M7 25q7-2 12 3M7 30q7-2 12 3m10-15q5-4 12-3m-12 8q5-4 12-3m-12 8q5-4 12-3" strokeWidth=".65"/><path d="M30 34 42 7l3-5 2 2-2 5-12 27-5 5zM42 7l3 2M30 34l3 2M28 41l2-7" strokeWidth="1"/><path d="M40 11l3 2" strokeWidth=".65"/></>,
 gift:<><path d="M8 19h32v23H8zM5 13h38v7H5zM24 13v29M24 13q-18 0-14-9 5-8 14 9 9-17 14-9 4 9-14 9"/></>,
 balloons:<><ellipse cx="15" cy="14" rx="9" ry="12"/><ellipse cx="34" cy="17" rx="9" ry="12"/><path d="m13 26 2 3 2-3m15 3 2 3 2-3M15 29l10 14 9-11"/></>,
 dining:<><circle cx="24" cy="24" r="13"/><circle cx="24" cy="24" r="9"/><path d="M5 8v32M2 8v10h6V8M43 8v32M40 8q7 4 3 14"/></>,
 coffee:<><path d="M8 16h27v15q-1 10-13 10T8 31zM35 19q14-3 10 8-2 5-10 5M6 43h34M15 4q-5 6 0 10m9-10q-5 6 0 10"/></>,
 crown:<><path d="m4 15 10 9 10-15 10 15 10-9-5 25H9zM10 35h28M4 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4m20-6a2 2 0 1 0 0-4 2 2 0 0 0 0 4m20 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4"/></>,
 star:<path d="m24 4 6 13 14 2-10 10 3 15-13-7-13 7 3-15L4 19l14-2z"/>,
 heart:<path d="M24 42 7 25Q-2 10 11 7q9-2 13 8 4-10 13-8 13 3 4 18z"/>,
 ribbon:<><path d="M24 22Q3 2 7 19q3 11 17 3Q45 2 41 19q-3 11-17 3M24 22l-8 21-6-8-7 2 12-18m9 3 8 21 6-8 7 2-12-18"/></>,
 airplane:<path d="m3 24 39-17-11 35-8-13-9 7 3-13zM17 23l25-16"/>,
 church:<><path d="M9 42V19l15-12 15 12v23M5 42h38M17 42V28h14v14M24 7V1m-4 3h8M9 24h30"/></>,
 leaf:<><path d="M9 41Q3 9 40 5q-2 34-31 36M9 41q12-21 31-36M20 29l-1-12m7 5 10 1"/></>,
 tree:<><path d="M24 44V22M12 34q-15-8-4-20 1-14 16-10 15-4 16 10 11 12-4 20zM24 31l-10-9m10 4 10-9"/></>,
 clock:<><circle cx="24" cy="24" r="19"/><path d="M24 11v14l9 6M24 2v4M24 42v4"/></>,
 car:<><path d="M5 18h38v20H5zM11 18l5-10h16l5 10M9 38v5h8v-5m14 0v5h8v-5M8 27h7m18 0h7M18 18h12"/></>
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

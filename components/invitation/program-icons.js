import { PROGRAM_ICON_IDS } from "../../lib/invitation-program";

// A single monochrome hand-drawn vocabulary shared by editor and published invitations.
// SVG paths are authored locally; no external assets or fonts are required.
const drawings = {
 rings:<><circle cx="15" cy="26" r="10"/><circle cx="29" cy="26" r="10"/><path d="m9 14 6-7 6 7-6 2zM23 14l6-7 6 7-6 2z"/></>,
 dress:<><path d="m18 7 6 5 6-5 3 6-5 7 10 20H10l10-20-5-7zM20 20h8M16 34q8 4 16 0"/></>,
 suit:<><path d="m18 7 6 5 6-5 8 6 3 26H7l3-26zM18 7l6 15 6-15M24 22v17M15 17l-4 6m22-6 4 6M22 13l2 3 2-3"/></>,
 bouquet:<><path d="M15 18 25 40M34 18 25 40M21 21l4 19M13 13q-6-10 3-9 8 2 4 11M31 13q-2-12 7-10 7 6-2 13M23 11q-5-12 4-10 9 5 0 14M14 25q10 7 20 0M20 36l9 2"/></>,
 flower:<><circle cx="24" cy="17" r="4"/><path d="M24 13C13 0 10 16 20 17M28 17C42 9 33 0 24 13M24 21c-8 15-20 1-4-4M28 17c14 10 3 19-4 4M24 21v21M24 33l-10-6M24 36l10-7"/></>,
 cake:<><path d="M8 25h32v16H8zM11 25v-9h26v9M16 16V9m8 7V7m8 9V9M13 30q4 7 8 0 4 7 8 0 4 7 8 0M6 42h36M16 8q-4-4 0-7 4 4 0 7M24 6q-4-4 0-6 4 4 0 6M32 8q-4-4 0-7 4 4 0 7"/></>,
 champagne:<><path d="M5 6h16l-2 12q-1 7-6 7t-6-7zM27 6h16l-2 12q-1 7-6 7t-6-7zM13 25v13m22-13v13M7 39h12m10 0h12M7 13h12m10 0h12M16 3l4-2m8 2-4-2"/></>,
 camera:<><path d="M5 14h9l4-5h12l4 5h9v25H5zM8 18h6M24 19a9 9 0 1 0 0 18 9 9 0 0 0 0-18M38 18h2M17 6h14"/></>,
 microphone:<><rect x="18" y="5" width="12" height="24" rx="6"/><path d="M14 21q0 15 10 15t10-15M24 36v7m-8 0h16M20 13h8m-8 6h8"/></>,
 music:<><path d="M19 33V9l19-4v25M19 14l19-4M19 33q-8-5-12 1-4 8 5 8 7 0 7-9M38 30q-8-5-12 1-4 8 5 8 7 0 7-9"/></>,
 book:<><path d="M24 11q-10-8-20-3v31q11-5 20 4 9-9 20-4V8q-10-5-20 3v32M10 15q7-2 11 3m7 0q5-5 11-3M10 24q7-2 11 3m7 0q5-5 11-3"/></>,
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
 return <svg className={className} width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{drawings[id]}</svg>;
}

import ProgramIcon from "./program-icons";
import { getProgramPresentation } from "../../lib/invitation-program";

export default function InvitationProgram({ program, eventKind }) {
  const display = getProgramPresentation(program, eventKind);
  if (!display.enabled) return null;
  const kicker = ({ wedding: "WEDDING CEREMONY", first_birthday: "FIRST BIRTHDAY", birthday: "BIRTHDAY CELEBRATION", milestone_birthday: "FAMILY CELEBRATION", gathering: "EVENT PROGRAM", opening: "OPENING CEREMONY" })[eventKind] || "EVENT PROGRAM";
  if (display.style === "editorial") return <div className="invitation-program invitation-program--editorial">
    <p className="invitation-program-editorial-kicker">{kicker}</p>
    <ol className="invitation-program-editorial-list" aria-label={display.title}>
      {display.items.map((item, index) => <li key={item.id} className={index % 2 ? "is-left" : "is-right"}>
        <span className="invitation-program-editorial-center" aria-hidden="true">{item.iconId ? <ProgramIcon id={item.iconId} size={50} /> : <span className="invitation-program-editorial-dot" />}</span>
        <span className="invitation-program-editorial-copy">
          {display.displayMode === "time" && item.time ? <time dateTime={item.time}>{item.time}</time> : display.displayMode === "number" ? <span className="invitation-program-editorial-index">{String(index+1).padStart(2,"0")}</span> : null}
          <span className="invitation-program-editorial-title">{item.title}</span>
          {item.description && <span className="invitation-program-editorial-description">{item.description}</span>}
        </span>
      </li>)}
    </ol>
  </div>;
  return <div className={`invitation-program invitation-program--${display.displayMode}`}>
    <p className="invitation-program-kicker" aria-hidden="true">{kicker}</p>
    <ol className="invitation-program-list" aria-label={display.title}>
      {display.items.map((item, index) => <li key={item.id}>
        <span className="invitation-program-step" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <span className="invitation-program-card">
          {display.displayMode === "time" && item.time && <time className="invitation-program-time" dateTime={item.time}>{item.time}</time>}
          {item.iconId && <span className="invitation-program-card-icon" aria-hidden="true"><ProgramIcon id={item.iconId} size={34} /></span>}
          <span className="invitation-program-card-copy"><span className="invitation-program-title">{item.title}</span>{item.description && <span className="invitation-program-description">{item.description}</span>}</span>
        </span>
      </li>)}
    </ol>
    <div className="invitation-program-ending" aria-hidden="true">✦</div>
  </div>;
}

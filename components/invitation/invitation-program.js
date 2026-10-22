import { getProgramPresentation } from "../../lib/invitation-program";

export default function InvitationProgram({ program, eventKind }) {
  const display = getProgramPresentation(program, eventKind);
  if (!display.enabled) return null;
  const kicker = ({ wedding: "WEDDING CEREMONY", first_birthday: "FIRST BIRTHDAY", birthday: "BIRTHDAY CELEBRATION", milestone_birthday: "FAMILY CELEBRATION", gathering: "EVENT PROGRAM", opening: "OPENING CEREMONY" })[eventKind] || "EVENT PROGRAM";
  return <div className={`invitation-program invitation-program--${display.displayMode}`}>
    <p className="invitation-program-kicker" aria-hidden="true">{kicker}</p>
    <ol className="invitation-program-list" aria-label={display.title}>
      {display.items.map((item, index) => <li key={item.id}>
        <span className="invitation-program-step" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <span className="invitation-program-card">
          {display.displayMode === "time" && item.time && <time className="invitation-program-time" dateTime={item.time}>{item.time}</time>}
          <span className="invitation-program-title">{item.title}</span>
        </span>
      </li>)}
    </ol>
    <div className="invitation-program-ending" aria-hidden="true">✦</div>
  </div>;
}

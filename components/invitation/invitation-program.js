import { getProgramPresentation } from "../../lib/invitation-program";

export default function InvitationProgram({ program, eventKind }) {
  const display = getProgramPresentation(program, eventKind);
  if (!display.enabled) return null;
  return <div className={`invitation-program invitation-program--${display.displayMode}`}>
    <ol className="invitation-program-list" aria-label={display.title}>
      {display.items.map((item, index) => <li key={item.id}>
        {display.displayMode === "number" && <span className="invitation-program-marker" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>}
        {display.displayMode === "time" && <span className="invitation-program-marker">{item.time && <time dateTime={item.time}>{item.time}</time>}</span>}
        <span className="invitation-program-node" aria-hidden="true" />
        <span className="invitation-program-title">{item.title}</span>
      </li>)}
    </ol>
  </div>;
}

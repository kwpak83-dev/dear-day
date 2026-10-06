const ACCOUNT_GROUP_FIELDS = {
  wedding: {
    groom: { bankKey: "groomBank", accountKey: "groomAccount", holderKey: "groomAccountHolder", nameKey: "groom", legacyLabel: "신랑 측", legacyRenderLabel: "신랑측" },
    bride: { bankKey: "brideBank", accountKey: "brideAccount", holderKey: "brideAccountHolder", nameKey: "bride", legacyLabel: "신부 측", legacyRenderLabel: "신부측" },
  },
  birthday: {
    host: { bankKey: "groomBank", accountKey: "groomAccount", holderKey: "groomAccountHolder", nameKey: "hostName", legacyLabel: "주최자", legacyRenderLabel: "주최자" },
  },
  gathering: {
    organizer: { bankKey: "groomBank", accountKey: "groomAccount", holderKey: "groomAccountHolder", nameKey: "hostName", legacyLabel: "회비·계좌", legacyRenderLabel: "회비·계좌" },
  },
  milestone_birthday: {
    host: { bankKey: "groomBank", accountKey: "groomAccount", holderKey: "groomAccountHolder", nameKey: "hostName", legacyLabel: "가족·주최자", legacyRenderLabel: "가족·주최자" },
  },
  first_birthday: {
    parent1: { bankKey: "groomBank", accountKey: "groomAccount", holderKey: "groomAccountHolder", nameKey: "parent1Name", legacyLabel: "부모/보호자 1", legacyRenderLabel: "부모/보호자 1" },
    parent2: { bankKey: "brideBank", accountKey: "brideAccount", holderKey: "brideAccountHolder", nameKey: "parent2Name", legacyLabel: "부모/보호자 2", legacyRenderLabel: "부모/보호자 2" },
  },
};

const LEGACY_SECTION_LABEL = "마음 전하실 곳";

function mapGroups(eventKind, labels, source, sectionLabel, enabled = true) {
  const fields = ACCOUNT_GROUP_FIELDS[eventKind];
  return {
    source,
    enabled,
    sectionLabel,
    groups: enabled ? Object.keys(fields).map((key) => ({
      key,
      label: labels[key],
      renderLabel: source === "configured" ? labels[key] : fields[key].legacyRenderLabel,
      ...fields[key],
    })) : [],
  };
}

export function getEventAccountGroups(eventKind, eventTypeConfig) {
  const fields = ACCOUNT_GROUP_FIELDS[eventKind];
  if (!fields) return { source: "legacy", enabled: false, sectionLabel: LEGACY_SECTION_LABEL, groups: [] };

  const fallback = () => mapGroups(
    eventKind,
    Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.legacyLabel])),
    "legacy",
    LEGACY_SECTION_LABEL,
  );
  const accounts = eventTypeConfig?.fields?.accounts;
  if (!accounts || !["required", "optional", "none"].includes(accounts.state) || !Array.isArray(accounts.groups)) return fallback();

  const expectedKeys = Object.keys(fields);
  const configured = new Map();
  for (const group of accounts.groups) {
    const key = String(group?.key || "").trim();
    const label = String(group?.label || "").trim();
    if (!fields[key] || !label || configured.has(key)) return fallback();
    configured.set(key, label);
  }
  if (configured.size !== expectedKeys.length || expectedKeys.some((key) => !configured.has(key))) return fallback();

  const sectionLabel = String(accounts.label || "").trim() || LEGACY_SECTION_LABEL;
  if (accounts.state === "none") return { source: "configured", enabled: false, sectionLabel, groups: [] };
  return mapGroups(eventKind, Object.fromEntries(configured), "configured", sectionLabel);
}

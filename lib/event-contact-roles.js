const CONTACT_ROLE_FIELDS = {
  wedding: {
    groom: { nameKey: "groom", phoneKey: "groomPhone", group: "couple", legacyRenderLabel: "신랑" },
    bride: { nameKey: "bride", phoneKey: "bridePhone", group: "couple", legacyRenderLabel: "신부" },
    groom_father: { nameKey: "groomFatherName", phoneKey: "groomFatherPhone", group: "groom_parents", legacyRenderLabel: "아버지" },
    groom_mother: { nameKey: "groomMotherName", phoneKey: "groomMotherPhone", group: "groom_parents", legacyRenderLabel: "어머니" },
    bride_father: { nameKey: "brideFatherName", phoneKey: "brideFatherPhone", group: "bride_parents", legacyRenderLabel: "아버지" },
    bride_mother: { nameKey: "brideMotherName", phoneKey: "brideMotherPhone", group: "bride_parents", legacyRenderLabel: "어머니" },
  },
  birthday: {
    subject: { nameKey: "person1Name", phoneKey: "person1Phone", group: "general", legacyRenderLabel: "주인공" },
    host: { nameKey: "hostName", phoneKey: "hostPhone", group: "general", legacyRenderLabel: "주최자" },
  },
  milestone_birthday: {
    host1: { nameKey: "host1Name", phoneKey: "host1Phone", group: "general", legacyRenderLabel: "가족·주최자 1", editableName: true },
    host2: { nameKey: "host2Name", phoneKey: "host2Phone", group: "general", legacyRenderLabel: "가족·주최자 2", editableName: true },
  },
  first_birthday: {
    parent1: { nameKey: "parent1Name", phoneKey: "parent1Phone", group: "parents", legacyRenderLabel: "아빠" },
    parent2: { nameKey: "parent2Name", phoneKey: "parent2Phone", group: "parents", legacyRenderLabel: "엄마" },
  },
};

const LEGACY_CONTACT_LABELS = {
  wedding: {
    groom: "신랑",
    bride: "신부",
    groom_father: "신랑 측 아버지",
    groom_mother: "신랑 측 어머니",
    bride_father: "신부 측 아버지",
    bride_mother: "신부 측 어머니",
  },
  first_birthday: { parent1: "부모 1", parent2: "부모 2" },
  birthday: { subject: "주인공", host: "주최자" },
  milestone_birthday: { host1: "가족·주최자 1", host2: "가족·주최자 2" },
};

const LEGACY_SECTION_LABELS = {
  wedding: "신랑·신부 및 양가 혼주 연락처",
  first_birthday: "부모 연락처",
  birthday: "연락처",
  milestone_birthday: "연락처",
};

const mapRoles = (eventKind, labels, source, sectionLabel, enabled = true) => {
  const fields = CONTACT_ROLE_FIELDS[eventKind];
  return {
    source,
    enabled,
    sectionLabel,
    roles: enabled ? Object.keys(fields).map((key) => ({ key, label: labels[key], renderLabel: source === "configured" ? labels[key] : fields[key].legacyRenderLabel, ...fields[key] })) : [],
  };
};

export function getEventContactRoles(eventKind, eventTypeConfig) {
  const fields = CONTACT_ROLE_FIELDS[eventKind];
  if (!fields) return { source: "legacy", enabled: false, sectionLabel: "연락처", roles: [] };

  const fallback = () => mapRoles(eventKind, LEGACY_CONTACT_LABELS[eventKind], "legacy", LEGACY_SECTION_LABELS[eventKind]);
  const contacts = eventTypeConfig?.fields?.contacts;
  if (!contacts || !["required", "optional", "none"].includes(contacts.state) || !Array.isArray(contacts.roles)) return fallback();

  const expectedKeys = Object.keys(fields);
  const configured = new Map();
  for (const role of contacts.roles) {
    const key = String(role?.key || "").trim();
    const label = String(role?.label || "").trim();
    if (!fields[key] || !label || configured.has(key)) return fallback();
    configured.set(key, label);
  }
  if (configured.size !== expectedKeys.length || expectedKeys.some((key) => !configured.has(key))) return fallback();

  const sectionLabel = String(contacts.label || "").trim() || LEGACY_SECTION_LABELS[eventKind];
  if (contacts.state === "none") return { source: "configured", enabled: false, sectionLabel, roles: [] };
  return mapRoles(eventKind, Object.fromEntries(configured), "configured", sectionLabel);
}

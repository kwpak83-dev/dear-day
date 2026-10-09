// Shared completed-template identity and thumbnail rules.
// A completed template is identified by its key; Hero/body IDs are validated
// before using its representative images. Legacy records use a unique pair.
export function matchesCompletedTemplate(item, heroPresetId, templateId) {
  return Boolean(item && heroPresetId && templateId &&
    item.hero_preset_id === heroPresetId && item.body_template_id === templateId);
}

export function findLegacyCompletedTemplate(items, heroPresetId, templateId, eventKind) {
  const matches = (Array.isArray(items) ? items : []).filter(item =>
    matchesCompletedTemplate(item, heroPresetId, templateId));
  const sameCategory = matches.filter(item => item.category === eventKind);
  const candidates = sameCategory.length ? sameCategory : matches;
  return candidates.length === 1 ? candidates[0] : null;
}

export function completedTemplateCardImages(item) {
  return {
    heroPresetId: item.hero_preset_id,
    templateId: item.body_template_id,
    heroUrl: item.thumbnail_1_url || null,
    bodyUrl: item.thumbnail_2_url || null,
  };
}

export function resolveTemplateThumbnail(ownThumbnail, completedThumbnail, isMatchingSelection) {
  return ownThumbnail || (isMatchingSelection ? completedThumbnail : null) || null;
}

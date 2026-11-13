// Public invitation articles are viewport-wide up to their existing 540px cap.
export function invitationPreviewWidth(viewportWidth) {
  return Math.min(viewportWidth, 540);
}

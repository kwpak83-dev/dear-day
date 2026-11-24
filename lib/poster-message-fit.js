// Measure the actual wrapped text in its fixed poster area.
export function fitPosterMessage(message) {
  if (!message || !message.parentElement || !message.parentElement.clientHeight || !message.clientWidth) return;
  const limit = message.parentElement.clientHeight;
  const fits = () => message.scrollHeight <= limit && message.scrollHeight <= message.clientHeight;
  message.style.fontSize = "4.2cqw";
  if (fits()) return;
  message.style.fontSize = "1.85cqw";
  if (!fits()) return;
  let low = 1.85, high = 4.2;
  for (let i = 0; i < 12; i++) {
    const mid = (low + high) / 2;
    message.style.fontSize = mid + "cqw";
    if (fits()) low = mid;
    else high = mid;
  }
  message.style.fontSize = low + "cqw";
}

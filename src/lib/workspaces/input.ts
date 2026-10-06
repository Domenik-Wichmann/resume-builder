import type { KeyboardEvent } from "react";

/** A conservative first-message hint; the visitor can correct it before sending. */
export function initialInputKind(text: string): "ask" | "match" {
  const value = text.trim();
  if (
    /^(what|how|why|when|where|who|can|does|did|has|is|tell me)\b/i.test(value)
  )
    return "ask";
  const signals = [
    /\b(responsibilities|requirements|qualifications)\b/i,
    /\b(we are hiring|we.re looking|job description|about the role)\b/i,
    /\b(you will|you.ll|must have|required skills|ideal candidate)\b/i,
  ];
  return signals.filter((pattern) => pattern.test(value)).length >= 2
    ? "match"
    : "ask";
}
export function submitComposerOnEnter(
  event: KeyboardEvent<HTMLTextAreaElement>,
  enabled: boolean,
) {
  if (
    event.key !== "Enter" ||
    event.shiftKey ||
    event.nativeEvent.isComposing ||
    event.keyCode === 229
  )
    return;
  event.preventDefault();
  if (!event.repeat && enabled) event.currentTarget.form?.requestSubmit();
}

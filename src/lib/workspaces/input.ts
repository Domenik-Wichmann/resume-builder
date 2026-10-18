import type { KeyboardEvent } from "react";

/** Conservatively distinguish pasted job descriptions from career questions. */
export function initialInputKind(text: string): "ask" | "match" {
  const value = text.trim();
  const jobHeading =
    /^(who we are|what (we offer|you(?:'ll| will) do|you bring))\b/i.test(
      value,
    );
  if (
    !jobHeading &&
    /^(what|how|why|when|where|who|can|could|would|should|do|does|did|has|is|are|tell me|compare|explain|describe|show me|please)\b/i.test(
      value,
    )
  )
    return "ask";
  const signals = [
    /\b(responsibilities|duties)\b/i,
    /\b(requirements|qualifications|required skills|must have)\b/i,
    /\b(we are hiring|we.re looking|job description|about the role)\b/i,
    /\b(you will|you.ll|ideal candidate)\b/i,
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

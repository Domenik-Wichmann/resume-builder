import { Fragment } from "react";
import type { ResumeIR } from "@/lib/resume-ir";

export function ResumeContactDetails({
  contact,
}: {
  contact: ResumeIR["profile"]["contact"];
}) {
  return [
    contact.location,
    contact.address,
    contact.contact_email,
    contact.phone,
  ]
    .filter(Boolean)
    .map((value, index) => (
      <Fragment key={index}>
        {index > 0 && " · "}
        {value === contact.contact_email ? (
          <a href={`mailto:${value}`}>{value}</a>
        ) : (
          value
        )}
      </Fragment>
    ));
}

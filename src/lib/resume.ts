import "server-only";
import { getCareer } from "./career/repository";
/** A résumé is a view of canonical evidence; generated tailoring is a later step. */
export async function getResume() {
  return getCareer();
}

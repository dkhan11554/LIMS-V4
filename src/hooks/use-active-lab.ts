import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";

/**
 * Returns the first laboratory the current user has access to.
 * Many queries are scoped to a laboratoryId, so this hook is
 * used throughout the app as the active-lab context.
 */
export function useActiveLab() {
  const labs = useQuery(api.organization.listLaboratories, {});
  const firstLab = labs?.[0];
  return { lab: firstLab, labs, labId: firstLab?._id };
}

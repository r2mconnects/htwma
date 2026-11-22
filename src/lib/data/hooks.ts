import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "./index";
import { DEFAULT_SETTINGS } from "./defaults";
import type { StorageBucket } from "./types";

export const qk = {
  settings: ["settings"] as const,
  members: ["members"] as const,
  member: (id: string) => ["members", id] as const,
  roles: ["committee", "roles"] as const,
  assignments: ["committee", "assignments"] as const,
  publicCommittee: ["committee", "public"] as const,
  gallery: ["gallery", "all"] as const,
  publishedGallery: ["gallery", "published"] as const,
  audit: ["audit"] as const,
  fees: ["fees"] as const,
  file: (bucket: string, path: string) => ["file", bucket, path] as const,
};

export function useSettings() {
  return useQuery({
    queryKey: qk.settings,
    queryFn: () => db.content.getSettings(),
    placeholderData: DEFAULT_SETTINGS,
  });
}

export function useMembers() {
  return useQuery({ queryKey: qk.members, queryFn: () => db.members.list() });
}

export function useMember(id: string) {
  return useQuery({ queryKey: qk.member(id), queryFn: () => db.members.get(id) });
}

export function useRoles() {
  return useQuery({ queryKey: qk.roles, queryFn: () => db.committee.listRoles() });
}

export function useAssignments() {
  return useQuery({ queryKey: qk.assignments, queryFn: () => db.committee.listAssignments() });
}

export function usePublicCommittee() {
  return useQuery({ queryKey: qk.publicCommittee, queryFn: () => db.committee.listPublic() });
}

export function useGallery() {
  return useQuery({ queryKey: qk.gallery, queryFn: () => db.gallery.list() });
}

export function usePublishedGallery() {
  return useQuery({ queryKey: qk.publishedGallery, queryFn: () => db.gallery.listPublished() });
}

export function useFileUrl(bucket: StorageBucket, path: string | null | undefined) {
  return useQuery({
    queryKey: qk.file(bucket, path ?? ""),
    queryFn: () => (path ? db.files.getUrl(bucket, path) : Promise.resolve(null)),
    enabled: !!path,
    staleTime: 1000 * 60 * 20,
  });
}

/** Invalidate everything a data change may affect. */
export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: ReadonlyArray<readonly unknown[]>) =>
    Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })));
}

export function useFees() {
  return useQuery({ queryKey: qk.fees, queryFn: () => db.fees.list() });
}

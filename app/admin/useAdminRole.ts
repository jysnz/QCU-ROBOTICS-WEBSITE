"use client";

import { useEffect, useRef, useState } from "react";
import { sb } from "./supabase";

/* The signed-in account's admin role: "super_admin" (names media heads), "media_head" (is prompted to assign competition
   tasks) or null. undefined while it loads. Set in website.admin_roles, see supabase/competition-tasks.sql. */
export type AdminRole = "super_admin" | "media_head" | "media_assistant" | null;

export function useAdminRole() {
  const [role, setRole] = useState<AdminRole | undefined>(undefined);
  useEffect(() => {
    let off = false;
    (async () => {
      const { data: s } = await sb.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) { if (!off) setRole(null); return; }
      const { data } = await sb.from("admin_roles").select("role").eq("user_id", uid).maybeSingle();
      if (!off) setRole((data?.role as AdminRole) ?? null);
    })();
    return () => { off = true; };
  }, []);
  return role;
}

/** Super admin or media head: names assistants, edits the templates. */
export const isHead = (r: AdminRole | undefined) => r === "super_admin" || r === "media_head";
/** Anyone who may assign tasks: the above plus the head's assistants. */
export const canAssignTasks = (r: AdminRole | undefined) => isHead(r) || r === "media_assistant";

/* For people who can assign tasks: asks the database to prepare tasks for competitions that are coming up (it does nothing when they
   already exist; a daily job does the same), then counts the suggestions still waiting to be assigned. `refreshKey`
   re-counts, e.g. when the section changes. */
export function usePendingPrompts(role: AdminRole | undefined, refreshKey: string) {
  const [n, setN] = useState(0);
  const generated = useRef(false);
  useEffect(() => {
    if (!canAssignTasks(role)) return;
    let off = false;
    (async () => {
      if (!generated.current) { generated.current = true; await sb.schema("public").rpc("generate_competition_tasks"); }
      const { count } = await sb.from("task_suggestions").select("id", { count: "exact", head: true }).eq("status", "pending");
      if (!off) setN(count ?? 0);
    })();
    return () => { off = true; };
  }, [role, refreshKey]);
  return n;
}

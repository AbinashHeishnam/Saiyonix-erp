import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@saiyonix/auth";
import { getParentProfile, getStudentMe } from "@saiyonix/api";
import type { ActiveStudent } from "@saiyonix/types";

type ActiveStudentContextValue = {
  activeStudent: ActiveStudent | null;
  activeStudentId: string | null;
  parentStudents: ActiveStudent[];
  setActiveStudentId: (id: string) => void;
  loading: boolean;
  error: Error | null;
};

const ActiveStudentContext = createContext<ActiveStudentContextValue | null>(null);

export function ActiveStudentProvider({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);

  const studentQuery = useQuery({
    queryKey: ["student", "me"],
    queryFn: getStudentMe,
    enabled: role === "STUDENT",
  });

  const parentQuery = useQuery({
    queryKey: ["parent", "profile"],
    queryFn: getParentProfile,
    enabled: role === "PARENT",
  });

  const parentStudents = useMemo(() => {
    const payload = parentQuery.data?.students ?? [];
    return Array.isArray(payload) ? (payload as ActiveStudent[]) : [];
  }, [parentQuery.data]);

  useEffect(() => {
    if (role !== "PARENT") return;
    if (!parentStudents.length) return;
    if (activeStudentId && parentStudents.some((student) => student.id === activeStudentId)) return;
    setActiveStudentId(parentStudents[0].id);
  }, [role, parentStudents, activeStudentId]);

  const resolvedActiveStudent = useMemo(() => {
    if (role === "STUDENT") return (studentQuery.data ?? null) as ActiveStudent | null;
    if (role === "PARENT") return parentStudents.find((student) => student.id === activeStudentId) ?? parentStudents[0] ?? null;
    return null;
  }, [role, studentQuery.data, parentStudents, activeStudentId]);

  const loading =
    (role === "STUDENT" && studentQuery.isLoading) ||
    (role === "PARENT" && parentQuery.isLoading);

  const error =
    (role === "STUDENT" && (studentQuery.error as Error | null)) ||
    (role === "PARENT" && (parentQuery.error as Error | null)) ||
    null;

  const setStudentId = useCallback((id: string) => setActiveStudentId(id), []);

  const value: ActiveStudentContextValue = {
    activeStudent: resolvedActiveStudent,
    activeStudentId: resolvedActiveStudent?.id ?? null,
    parentStudents,
    setActiveStudentId: setStudentId,
    loading,
    error,
  };

  return <ActiveStudentContext.Provider value={value}>{children}</ActiveStudentContext.Provider>;
}

export function useActiveStudent() {
  const ctx = useContext(ActiveStudentContext);
  if (!ctx) {
    throw new Error("useActiveStudent must be used within ActiveStudentProvider");
  }
  return ctx;
}

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@saiyonix/auth";
import { getParentProfile, getStudentMe } from "@saiyonix/api";
import type { ActiveStudent } from "@saiyonix/types";

export function useActiveStudent() {
  const { role } = useAuth();

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
    if (!Array.isArray(payload)) return [] as ActiveStudent[];
    return payload as ActiveStudent[];
  }, [parentQuery.data]);

  const activeStudent = useMemo(() => {
    if (role === "STUDENT") return (studentQuery.data ?? null) as ActiveStudent | null;
    if (role === "PARENT") return parentStudents[0] ?? null;
    return null;
  }, [role, studentQuery.data, parentStudents]);

  const loading =
    (role === "STUDENT" && studentQuery.isLoading) ||
    (role === "PARENT" && parentQuery.isLoading);

  const error =
    (role === "STUDENT" && (studentQuery.error as Error | null)) ||
    (role === "PARENT" && (parentQuery.error as Error | null)) ||
    null;

  return {
    activeStudent,
    parentStudents,
    loading,
    error,
  };
}

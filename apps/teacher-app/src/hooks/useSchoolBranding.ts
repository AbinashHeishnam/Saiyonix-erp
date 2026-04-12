import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSchoolOverview, resolvePublicUrl } from "@saiyonix/api";

export default function useSchoolBranding() {
  const query = useQuery({
    queryKey: ["school-overview"],
    queryFn: getSchoolOverview,
  });

  const schoolName = useMemo(() => {
    const name = query.data?.schoolName?.trim();
    return name && name.length > 0 ? name : "School Platform";
  }, [query.data?.schoolName]);

  const logoUrl = useMemo(() => {
    const raw = query.data?.logoUrl;
    return raw ? resolvePublicUrl(raw) : null;
  }, [query.data?.logoUrl]);

  return {
    schoolName,
    logoUrl,
    isLoading: query.isLoading,
    error: query.error,
  };
}

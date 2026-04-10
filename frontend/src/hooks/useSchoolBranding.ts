import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../contexts/AuthContext";
import {
  getPublicSchoolOverview,
  getSchoolOverview,
  type SchoolOverview,
} from "../services/api/schoolOverview";
import { API_BASE_URL } from "../services/api/client";

const FALLBACK_NAME = "School Portal";

export function useSchoolBranding() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["school-overview"],
    queryFn: user ? getSchoolOverview : getPublicSchoolOverview,
    enabled: true,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (count, err: any) => {
      if (err?.response?.status === 429) return false;
      return count < 1;
    },
  });

  const data: SchoolOverview | undefined = query.data;
  const publicLogoUrl =
    !user && data?.logoUrl ? `${API_BASE_URL}/school/logo/public` : null;

  return {
    ...query,
    branding: {
      schoolName: data?.schoolName?.trim() || FALLBACK_NAME,
      schoolAddress: data?.schoolAddress ?? "",
      schoolPhone: data?.schoolPhone ?? "",
      officialEmail: data?.officialEmail ?? "",
      logoUrl: user ? data?.logoUrl ?? null : publicLogoUrl,
    },
  };
}

export const SCHOOL_NAME_FALLBACK = FALLBACK_NAME;

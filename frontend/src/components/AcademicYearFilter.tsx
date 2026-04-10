import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import Select from "./Select";
import { listAcademicYears, type AcademicYear } from "../services/api/metadata";
import { useAsync } from "../hooks/useAsync";
import { getActiveAcademicYear } from "../utils/academicYear";

type AcademicYearFilterProps = {
  value?: string;
  onChange?: (academicYearId: string) => void;
  label?: string;
  includeAllOption?: boolean;
  allLabel?: string;
  syncQueryKey?: string;
  className?: string;
  years?: AcademicYear[];
  disabled?: boolean;
};

const ALL_VALUE = "__ALL__";

function normalizeYears(payload: any): AcademicYear[] {
  if (Array.isArray(payload)) return payload as AcademicYear[];
  if (Array.isArray(payload?.items)) return payload.items as AcademicYear[];
  if (Array.isArray(payload?.data)) return payload.data as AcademicYear[];
  return [];
}

export default function AcademicYearFilter({
  value,
  onChange,
  label = "Academic Year",
  includeAllOption = false,
  allLabel = "All Years",
  syncQueryKey,
  className,
  years,
  disabled,
}: AcademicYearFilterProps) {
  const isControlled = value !== undefined;
  const [searchParams, setSearchParams] = useSearchParams();
  const queryValue = syncQueryKey ? searchParams.get(syncQueryKey) : null;

  const { data: fetched, loading } = useAsync(
    () => (years ? Promise.resolve(years) : listAcademicYears()),
    [Boolean(years)]
  );

  const resolvedYears = useMemo(
    () => normalizeYears(years ?? fetched),
    [years, fetched]
  );
  const activeYear = useMemo(
    () => getActiveAcademicYear(resolvedYears),
    [resolvedYears]
  );

  const [internalValue, setInternalValue] = useState("");

  useEffect(() => {
    const normalizedQuery =
      includeAllOption && queryValue === "all" ? "" : queryValue ?? "";
    if (isControlled) {
      if (!value && normalizedQuery) {
        onChange?.(normalizedQuery);
      } else if (!value && !normalizedQuery && activeYear?.id) {
        onChange?.(activeYear.id);
      }
      return;
    }
    if (normalizedQuery) {
      setInternalValue(normalizedQuery);
      return;
    }
    if (!internalValue && activeYear?.id) {
      setInternalValue(activeYear.id);
    }
  }, [isControlled, includeAllOption, queryValue, activeYear?.id, internalValue, value, onChange]);

  const selectedValue = isControlled ? value ?? "" : internalValue;
  const selectValue =
    includeAllOption && !selectedValue ? ALL_VALUE : selectedValue;

  const handleChange = (next: string) => {
    const normalized = next === ALL_VALUE ? "" : next;
    if (!isControlled) {
      setInternalValue(normalized);
    }
    if (syncQueryKey) {
      const params = new URLSearchParams(searchParams);
      if (normalized) {
        params.set(syncQueryKey, normalized);
      } else if (includeAllOption) {
        params.set(syncQueryKey, "all");
      } else {
        params.delete(syncQueryKey);
      }
      setSearchParams(params, { replace: true });
    }
    onChange?.(normalized);
  };

  return (
    <div className={className}>
      <Select
        label={label}
        value={selectValue}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled || loading}
      >
        {includeAllOption ? (
          <option value={ALL_VALUE}>{allLabel}</option>
        ) : null}
        {resolvedYears.map((year) => (
          <option key={year.id} value={year.id}>
            {year.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

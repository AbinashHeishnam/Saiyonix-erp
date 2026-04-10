import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import Input from "../../components/Input";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import StudentIdCard from "../../components/StudentIdCard";
import Modal from "../../components/Modal";
import Button from "../../components/Button";
import AcademicYearFilter from "../../components/AcademicYearFilter";
import api from "../../services/api/client";
import { listSections } from "../../services/api/metadata";
import {
  getAdminStudentIdCards,
  updateStudentIdCardPhoto,
  updateStudentIdCardDetails,
} from "../../services/api/idCards";

export default function AdminStudentIdCardsPage() {
  const [academicYearId, setAcademicYearId] = useState("");
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editAdmission, setEditAdmission] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editBloodGroup, setEditBloodGroup] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editParentName, setEditParentName] = useState("");
  const [editParentPhone, setEditParentPhone] = useState("");
  const [editClassId, setEditClassId] = useState("");
  const [editSectionId, setEditSectionId] = useState("");
  const [editRollNumber, setEditRollNumber] = useState("");
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const cardsQuery = useQuery({
    queryKey: ["admin-id-cards", academicYearId],
    queryFn: () => getAdminStudentIdCards({ academicYearId: academicYearId || undefined }),
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const classesQuery = useQuery({
    queryKey: ["classes", academicYearId],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: 1, limit: 200 };
      if (academicYearId) params.academicYearId = academicYearId;
      const res = await api.get("/classes", { params });
      return res.data?.data ?? res.data ?? [];
    },
  });

  const sectionFetchClassId = editClassId || classId;
  const sectionsQuery = useQuery({
    queryKey: ["sections", academicYearId, sectionFetchClassId],
    queryFn: async () => {
      const res = await listSections({
        academicYearId: academicYearId || undefined,
        classId: sectionFetchClassId || undefined,
      });
      return res?.data ?? res ?? [];
    },
  });

  const filteredSections = useMemo(() => {
    const sections = sectionsQuery.data ?? [];
    if (!classId) return sections;
    return sections.filter((section: any) => section.classId === classId);
  }, [sectionsQuery.data, classId]);

  const editFilteredSections = useMemo(() => {
    const sections = sectionsQuery.data ?? [];
    if (!editClassId) return sections;
    return sections.filter((section: any) => section.classId === editClassId);
  }, [sectionsQuery.data, editClassId]);

  const classIds = useMemo(
    () => new Set((classesQuery.data ?? []).map((cls: any) => cls.id)),
    [classesQuery.data]
  );
  const sectionIds = useMemo(
    () => new Set((filteredSections ?? []).map((section: any) => section.id)),
    [filteredSections]
  );

  useEffect(() => {
    if (classId && !classIds.has(classId)) {
      setClassId("");
      setSectionId("");
    }
    if (sectionId && !sectionIds.has(sectionId)) {
      setSectionId("");
    }
  }, [classIds, sectionIds, classId, sectionId]);

  const filteredCards = useMemo(() => {
    const cards = cardsQuery.data ?? [];
    const term = search.trim().toLowerCase();
    return cards.filter((card) => {
      if (classId && card.classId !== classId) return false;
      if (sectionId && card.sectionId !== sectionId) return false;
      if (!term) return true;
      const haystack = [
        card.student.fullName,
        card.student.admissionNumber,
        card.className,
        card.sectionName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [cardsQuery.data, search, classId, sectionId]);

  if (cardsQuery.isLoading) {
    return <LoadingState label="Loading student ID cards" />;
  }

  if (cardsQuery.isError) {
    return (
      <Card>
        <p className="text-sm text-rose-600">Unable to load student ID cards.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Digital ID Cards" subtitle="All active student identity cards" />

      <Card title="Filters" subtitle="Search by student or filter by class/section">
        <div className="grid gap-4 md:grid-cols-3">
          <AcademicYearFilter
            value={academicYearId}
            onChange={setAcademicYearId}
            syncQueryKey="academicYearId"
          />
          <Input
            label="Search"
            placeholder="Name or Admission No."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="Class"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSectionId("");
            }}
          >
            <option value="">All Classes</option>
            {(classesQuery.data ?? []).map((cls: any) => (
              <option key={cls.id} value={cls.id}>{cls.className ?? "Class"}</option>
            ))}
          </Select>
          <Select
            label="Section"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            disabled={!classId}
          >
            <option value="">All Sections</option>
            {filteredSections.map((section: any) => (
              <option key={section.id} value={section.id}>{section.sectionName ?? "Section"}</option>
            ))}
          </Select>
        </div>
      </Card>

      {filteredCards.length ? (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {filteredCards.map((card) => (
            <div key={card.student.id} className="relative transition-transform hover:-translate-y-1">
              <StudentIdCard data={card} />
              <div className="absolute right-3 top-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditing(card);
                    setEditName(card.student.fullName ?? "");
                    setEditAdmission(card.student.admissionNumber ?? "");
                    setEditDob(card.student.dateOfBirth ? new Date(card.student.dateOfBirth).toISOString().slice(0, 10) : "");
                    setEditBloodGroup(card.student.bloodGroup ?? "");
                    setEditAddress(card.student.address ?? "");
                    setEditParentName(card.parentName ?? "");
                    setEditParentPhone(card.parentPhone ?? "");
                    setEditClassId(card.classId ?? "");
                    setEditSectionId(card.sectionId ?? "");
                    setEditRollNumber(card.rollNumber ? String(card.rollNumber) : "");
                    setEditPhoto(null);
                    setSaveError("");
                  }}
                >
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No ID cards found" description="Try adjusting search or filters." />
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => {
          if (saving) return;
          setEditing(null);
        }}
        title="Edit ID Card"
        size="sm"
      >
        {editing && (
          <div className="flex flex-col gap-4">
            <Input
              label="Student Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <Input
              label="Admission Number"
              value={editAdmission}
              onChange={(e) => setEditAdmission(e.target.value)}
            />
            <Input
              label="Date of Birth"
              type="date"
              value={editDob}
              onChange={(e) => setEditDob(e.target.value)}
            />
            <Input
              label="Blood Group"
              value={editBloodGroup}
              onChange={(e) => setEditBloodGroup(e.target.value)}
            />
            <Input
              label="Address"
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
            />
            <Input
              label="Parent Name"
              value={editParentName}
              onChange={(e) => setEditParentName(e.target.value)}
            />
            <Input
              label="Parent Phone"
              value={editParentPhone}
              onChange={(e) => setEditParentPhone(e.target.value)}
            />
            <Select
              label="Class"
              value={editClassId}
              onChange={(e) => {
                setEditClassId(e.target.value);
                setEditSectionId("");
              }}
            >
              <option value="">Select Class</option>
              {(classesQuery.data ?? []).map((cls: any) => (
                <option key={cls.id} value={cls.id}>{cls.className ?? "Class"}</option>
              ))}
            </Select>
            <Select
              label="Section"
              value={editSectionId}
              onChange={(e) => setEditSectionId(e.target.value)}
              disabled={!editClassId}
            >
              <option value="">Select Section</option>
              {editFilteredSections.map((section: any) => (
                <option key={section.id} value={section.id}>{section.sectionName ?? "Section"}</option>
              ))}
            </Select>
            <Input
              label="Roll Number"
              type="number"
              value={editRollNumber}
              onChange={(e) => setEditRollNumber(e.target.value)}
            />

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Profile Photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setEditPhoto(e.target.files?.[0] ?? null)}
              />
            </div>

            {saveError && <p className="text-xs text-rose-600">{saveError}</p>}

            <div className="flex flex-wrap gap-3">
              <Button
                loading={saving}
                onClick={async () => {
                  if (!editing) return;
                  setSaving(true);
                  setSaveError("");
                  try {
                    await updateStudentIdCardDetails(editing.student.id, {
                      fullName: editName.trim() || undefined,
                      admissionNumber: editAdmission.trim() || undefined,
                      dateOfBirth: editDob || undefined,
                      bloodGroup: editBloodGroup.trim() || undefined,
                      address: editAddress.trim() || undefined,
                      parentName: editParentName.trim() || undefined,
                      parentPhone: editParentPhone.trim() || undefined,
                      classId: editClassId || undefined,
                      sectionId: editSectionId || undefined,
                      rollNumber: editRollNumber ? Number(editRollNumber) : undefined,
                    });
                    if (editPhoto) {
                      await updateStudentIdCardPhoto(editing.student.id, editPhoto);
                    }
                    await cardsQuery.refetch();
                    setEditing(null);
                  } catch (err: any) {
                    setSaveError(err?.response?.data?.message ?? "Unable to update ID card.");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Save Changes
              </Button>
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

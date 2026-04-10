import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import Input from "../../components/Input";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import TeacherIdCard from "../../components/TeacherIdCard";
import Modal from "../../components/Modal";
import Button from "../../components/Button";
import {
  getAdminTeacherIdCards,
  updateTeacherIdCardDetails,
  updateTeacherIdCardPhoto,
} from "../../services/api/teacherIdCards";

export default function AdminTeacherIdCardsPage() {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [editDesignation, setEditDesignation] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editJoiningDate, setEditJoiningDate] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const cardsQuery = useQuery({
    queryKey: ["admin-teacher-id-cards"],
    queryFn: getAdminTeacherIdCards,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const filteredCards = useMemo(() => {
    const cards = cardsQuery.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return cards;
    return cards.filter((card) => {
      const haystack = [
        card.teacher.fullName,
        card.teacher.employeeId,
        card.teacher.department,
        card.teacher.designation,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [cardsQuery.data, search]);

  if (cardsQuery.isLoading) {
    return <LoadingState label="Loading teacher ID cards" />;
  }

  if (cardsQuery.isError) {
    return (
      <Card>
        <p className="text-sm text-rose-600">Unable to load teacher ID cards.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Teacher ID Cards" subtitle="All active faculty identity cards" />

      <Card title="Search" subtitle="Find by name, employee ID, department or designation">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Search"
            placeholder="Name / Employee ID / Department"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      {filteredCards.length ? (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {filteredCards.map((card) => (
            <div key={card.teacher.id} className="relative transition-transform hover:-translate-y-1">
              <TeacherIdCard data={card} />
              <div className="absolute right-3 top-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditing(card);
                    setEditName(card.teacher.fullName ?? "");
                    setEditEmployeeId(card.teacher.employeeId ?? "");
                    setEditDesignation(card.teacher.designation ?? "");
                    setEditDepartment(card.teacher.department ?? "");
                    setEditJoiningDate(card.teacher.joiningDate ? new Date(card.teacher.joiningDate).toISOString().slice(0, 10) : "");
                    setEditPhone(card.teacher.phone ?? "");
                    setEditEmail(card.teacher.email ?? "");
                    setEditAddress(card.teacher.address ?? "");
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
        <EmptyState title="No ID cards found" description="Try adjusting search terms." />
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => {
          if (saving) return;
          setEditing(null);
        }}
        title="Edit Teacher ID Card"
        size="sm"
      >
        {editing && (
          <div className="flex flex-col gap-4">
            <Input
              label="Full Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <Input
              label="Employee ID"
              value={editEmployeeId}
              onChange={(e) => setEditEmployeeId(e.target.value)}
            />
            <Input
              label="Designation"
              value={editDesignation}
              onChange={(e) => setEditDesignation(e.target.value)}
            />
            <Input
              label="Department"
              value={editDepartment}
              onChange={(e) => setEditDepartment(e.target.value)}
            />
            <Input
              label="Joining Date"
              type="date"
              value={editJoiningDate}
              onChange={(e) => setEditJoiningDate(e.target.value)}
            />
            <Input
              label="Phone"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />
            <Input
              label="Email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />
            <Input
              label="Address"
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
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
                    await updateTeacherIdCardDetails(editing.teacher.id, {
                      fullName: editName.trim() || undefined,
                      employeeId: editEmployeeId.trim() || undefined,
                      designation: editDesignation.trim() || undefined,
                      department: editDepartment.trim() || undefined,
                      joiningDate: editJoiningDate || undefined,
                      phone: editPhone.trim() || undefined,
                      email: editEmail.trim() || undefined,
                      address: editAddress.trim() || undefined,
                    });
                    if (editPhoto) {
                      await updateTeacherIdCardPhoto(editing.teacher.id, editPhoto);
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

import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import Button from "../../components/Button";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import LoadingState from "../../components/LoadingState";
import PageHeader from "../../components/PageHeader";
import StudentIdCard from "../../components/StudentIdCard";
import { useAuth } from "../../contexts/AuthContext";
import { usePrint } from "../../hooks/usePrint";
import { getParentChildIdCard, getStudentIdCard } from "../../services/api/idCards";

export default function IdCardPage() {
  const { role } = useAuth();
  const idCardRef = useRef<HTMLDivElement | null>(null);
  const printRootRef = useRef<HTMLDivElement | null>(null);
  const handlePrint = usePrint(printRootRef, { center: true });

  const queryFn = useMemo(() => {
    if (role === "PARENT") return getParentChildIdCard;
    return getStudentIdCard;
  }, [role]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["id-card", role],
    queryFn,
    enabled: role === "STUDENT" || role === "PARENT",
  });

  const handleDownload = async () => {
    if (!idCardRef.current) return;
    const canvas = await html2canvas(idCardRef.current, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [canvas.width, canvas.height],
    });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save(role === "PARENT" ? "child-id-card.pdf" : "student-id-card.pdf");
  };

  if (isLoading) return <LoadingState label="Loading ID card" />;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Digital ID Card" subtitle="Official school identity card" />

      <Card>
        {isError || !data ? (
          <EmptyState title="ID card unavailable" description="Please contact the administration." />
        ) : (
          <div className="flex flex-col items-center gap-5">
            <div ref={printRootRef} className="id-card-print-area print-root print-center print-color">
              <div ref={idCardRef} className="id-card-printable">
                <StudentIdCard data={data} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleDownload}>Download PDF</Button>
              <Button variant="secondary" onClick={handlePrint}>Print</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

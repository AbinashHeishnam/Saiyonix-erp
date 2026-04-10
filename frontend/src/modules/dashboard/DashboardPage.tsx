
import { useAuth } from "../../contexts/AuthContext";
import AdminDashboard from "./AdminDashboard";
import AcademicSubAdminDashboard from "./AcademicSubAdminDashboard";
import FinanceSubAdminDashboard from "./FinanceSubAdminDashboard";
import ParentDashboard from "./ParentDashboard";
import StudentDashboard from "./StudentDashboard";
import TeacherDashboard from "./TeacherDashboard";
import Card from "../../components/Card";

export default function DashboardPage() {
  const { role } = useAuth();

  if (role === "TEACHER") return <TeacherDashboard />;
  if (role === "STUDENT") return <StudentDashboard />;
  if (role === "PARENT") return <ParentDashboard />;
  if (role === "ACADEMIC_SUB_ADMIN") return <AcademicSubAdminDashboard />;
  if (role === "FINANCE_SUB_ADMIN") return <FinanceSubAdminDashboard />;
  if (role === "ADMIN" || role === "SUPER_ADMIN") return <AdminDashboard />;

  return (
    <Card>
      <p className="text-sm text-ink-500">No dashboard configured for this role.</p>
    </Card>
  );
}

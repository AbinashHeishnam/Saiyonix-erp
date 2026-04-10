
import { useAuth } from "../../contexts/AuthContext";
import AttendanceStudentPage from "./AttendanceStudentPage";
import AttendanceTeacherPage from "./AttendanceTeacherPage";
import Card from "../../components/Card";

export default function AttendancePage() {
  const { role } = useAuth();

  if (role === "TEACHER") return <AttendanceTeacherPage />;
  if (role === "STUDENT" || role === "PARENT") return <AttendanceStudentPage />;

  return (
    <Card>
      <p className="text-sm text-ink-500">Attendance is not available for this role.</p>
    </Card>
  );
}

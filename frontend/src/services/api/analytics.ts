import api from "./client";

export type StudentAnalyticsResponse = {
    studentInfo: {
        name: string;
        class: string;
        section: string;
    };
    overall: {
        totalMarks: number;
        percentage: number;
        rank: number | null;
        passStatus: "PASS" | "FAIL";
    };
    subjectWise: Array<{
        subject: string;
        marks: number;
        maxMarks: number;
        percentage: number;
        pass: boolean;
    }>;
    trends: Array<{
        examName: string;
        percentage: number;
    }>;
    classStats: {
        classAverage: number;
        highest: number;
        lowest: number;
        passPercentage: number;
    };
    attendance: {
        averagePercentage: number;
        trend: Array<{
            date: string;
            percentage: number;
        }>;
    };
};

export async function getStudentAnalytics(studentId: string, examId?: string): Promise<StudentAnalyticsResponse> {
    const res = await api.get(`/analytics/student/${studentId}`, {
        params: examId ? { examId } : undefined,
    });
    return res.data?.data ?? res.data;
}

export type SchoolAnalyticsResponse = {
    summary: {
        totalStudents: number;
        totalTeachers: number;
        averageAttendance: number;
    };
    admissionTrend: Array<{
        month: string;
        admissions: number;
    }>;
    attendanceTrend: Array<{
        date: string;
        percentage: number;
    }>;
    performance: {
        examTitle: string;
        passCount: number;
        failCount: number;
    };
};

export async function getSchoolAnalytics(params?: { academicYearId?: string }): Promise<SchoolAnalyticsResponse> {
    const res = await api.get(`/analytics/school`, {
        params: params?.academicYearId ? { academicYearId: params.academicYearId } : undefined,
    });
    return res.data?.data ?? res.data;
}

import { z } from "zod";
export const sectionIdSchema = z.string().uuid();
export const classSubjectIdSchema = z.string().uuid();
export const sectionIdParamSchema = z.object({ sectionId: sectionIdSchema }).strict();
export const classSubjectIdParamSchema = z.object({ classSubjectId: classSubjectIdSchema }).strict();
export const studentIdQuerySchema = z
    .object({
    studentId: z.string().uuid().optional(),
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).max(50).optional(),
})
    .strict();
export const chatRoomIdParamSchema = z.object({ roomId: z.string().uuid() }).strict();
export const chatMessageIdParamSchema = z.object({ messageId: z.string().uuid() }).strict();
export const chatRoomMessagesQuerySchema = z.object({
    limit: z.coerce.number().min(1).max(50).optional(),
    before: z.string().datetime().optional(),
}).strict();
export const classroomAssignmentCreateSchema = z.object({
    classId: z.string().uuid(),
    sectionId: z.string().uuid().nullable().optional(),
    subjectId: z.string().uuid(),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1).nullable().optional(),
    deadline: z.coerce.date(),
    maxMarks: z.coerce.number().min(0).nullable().optional(),
    fileUrl: z.string().trim().min(1).nullable().optional(),
    fileName: z.string().trim().min(1).nullable().optional(),
    fileKey: z.string().trim().min(1).nullable().optional(),
}).strict();
export const classroomNotesCreateSchema = z.object({
    classId: z.string().uuid(),
    sectionId: z.string().uuid().nullable().optional(),
    subjectId: z.string().uuid(),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1).nullable().optional(),
    fileUrl: z.string().trim().min(1).nullable().optional(),
    fileType: z.string().trim().min(1).nullable().optional(),
}).strict();
export const classroomAnnouncementCreateSchema = z.object({
    classId: z.string().uuid(),
    sectionId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1),
    content: z.string().trim().min(1),
}).strict();
export const classroomAssignmentSubmitSchema = z.object({
    assignmentId: z.string().uuid(),
    submissionUrl: z.string().trim().min(1),
    studentId: z.string().uuid().optional(),
}).strict();

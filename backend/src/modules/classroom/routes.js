import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import { allowRoles } from "@/middleware/rbac.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import { validate } from "@/middleware/validate.middleware";
import { sectionDetail, studentMe, subjectDetail, teacherMe, createClassroomAssignment, createClassroomAnnouncement, createClassroomNote, submitClassroomAssignment, chatRoomMessages, pinChatMessage, } from "@/modules/classroom/controller";
import { classSubjectIdParamSchema, chatRoomIdParamSchema, chatRoomMessagesQuerySchema, chatMessageIdParamSchema, classroomAnnouncementCreateSchema, classroomAssignmentCreateSchema, classroomAssignmentSubmitSchema, classroomNotesCreateSchema, sectionIdParamSchema, studentIdQuerySchema, } from "@/modules/classroom/validation";
const classroomRouter = Router();
const allowClassroomRead = (req, res, next) => {
    try {
        const role = req.user?.roleType ??
            req.user?.role;
        if (role === "TEACHER" || role === "STUDENT" || role === "PARENT") {
            return next();
        }
        return requirePermission("assignment:read")(req, res, next);
    }
    catch (err) {
        return next(err);
    }
};
classroomRouter.get("/teacher/me", authMiddleware, allowRoles("TEACHER", "ADMIN", "SUPER_ADMIN"), allowClassroomRead, teacherMe);
classroomRouter.get("/student/me", authMiddleware, allowRoles("STUDENT", "PARENT", "TEACHER", "ADMIN"), allowClassroomRead, validate({ query: studentIdQuerySchema }), studentMe);
classroomRouter.get("/section/:sectionId", authMiddleware, allowRoles("TEACHER", "STUDENT", "PARENT", "ADMIN", "SUPER_ADMIN"), allowClassroomRead, validate({ params: sectionIdParamSchema }), sectionDetail);
classroomRouter.get("/subject/:classSubjectId", authMiddleware, allowRoles("TEACHER", "STUDENT", "PARENT", "ADMIN", "SUPER_ADMIN"), allowClassroomRead, validate({ params: classSubjectIdParamSchema, query: studentIdQuerySchema }), subjectDetail);
classroomRouter.get("/chat/room/:roomId", authMiddleware, allowRoles("TEACHER", "STUDENT", "PARENT", "ADMIN", "SUPER_ADMIN"), validate({ params: chatRoomIdParamSchema, query: chatRoomMessagesQuerySchema }), chatRoomMessages);
classroomRouter.post("/chat/pin/:messageId", authMiddleware, allowRoles("TEACHER", "ADMIN", "SUPER_ADMIN"), validate({ params: chatMessageIdParamSchema }), pinChatMessage);
classroomRouter.post("/chat/unpin/:messageId", authMiddleware, allowRoles("TEACHER", "ADMIN", "SUPER_ADMIN"), validate({ params: chatMessageIdParamSchema }), pinChatMessage);
classroomRouter.post("/assignment/create", authMiddleware, allowRoles("TEACHER", "ADMIN", "SUPER_ADMIN"), requirePermission("assignment:create"), validate(classroomAssignmentCreateSchema), createClassroomAssignment);
classroomRouter.post("/notes/create", authMiddleware, allowRoles("TEACHER", "ADMIN", "SUPER_ADMIN"), requirePermission("note:create"), validate(classroomNotesCreateSchema), createClassroomNote);
classroomRouter.post("/announcement/create", authMiddleware, allowRoles("TEACHER", "ADMIN", "SUPER_ADMIN"), requirePermission("note:create"), validate(classroomAnnouncementCreateSchema), createClassroomAnnouncement);
classroomRouter.post("/assignment/submit", authMiddleware, allowRoles("STUDENT", "PARENT", "TEACHER", "ADMIN"), requirePermission("assignment:submit"), validate(classroomAssignmentSubmitSchema), submitClassroomAssignment);
export default classroomRouter;

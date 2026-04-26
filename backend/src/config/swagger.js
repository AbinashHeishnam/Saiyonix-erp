import swaggerJSDoc from "swagger-jsdoc";
const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "SaiyoniX ERP API",
            version: "1.0.0",
            description: "Phase-1 Auth/RBAC API documentation",
        },
        servers: [{ url: "http://localhost:3000" }],
        tags: [
            { name: "Auth", description: "Authentication endpoints" },
            { name: "OTP", description: "OTP endpoints" },
            { name: "Session", description: "Session management endpoints" },
            { name: "AcademicYear", description: "Academic year master data endpoints" },
            { name: "Class", description: "Class master data endpoints" },
            { name: "Section", description: "Section master data endpoints" },
            { name: "Subject", description: "Subject master data endpoints" },
            { name: "Period", description: "Period master data endpoints" },
            { name: "ClassSubject", description: "Class subject mapping endpoints" },
            { name: "Teacher", description: "Teacher master data endpoints" },
            {
                name: "TeacherSubjectClass",
                description: "Teacher-subject-class assignment endpoints",
            },
            { name: "TimetableSlot", description: "Timetable slot endpoints" },
            { name: "Student", description: "Student management endpoints" },
            { name: "StudentAttendance", description: "Student attendance endpoints" },
            { name: "StudentBulkImport", description: "Student bulk import endpoints" },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
            schemas: {
                ApiResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        data: {},
                        message: { type: "string" },
                        pagination: { type: "object" },
                    },
                },
            },
        },
        paths: {
            "/api/v1/auth/register": {
                post: {
                    tags: ["Auth"],
                    summary: "Register user",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["email", "password", "roleId"],
                                    properties: {
                                        email: { type: "string", format: "email" },
                                        password: { type: "string" },
                                        roleId: { type: "string", format: "uuid" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "201": { description: "Created" } },
                },
            },
            "/api/v1/auth/login": {
                post: {
                    tags: ["Auth"],
                    summary: "Login with email/password",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["email", "password"],
                                    properties: {
                                        email: { type: "string", format: "email" },
                                        password: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/auth/refresh": {
                post: {
                    tags: ["Auth"],
                    summary: "Refresh access token",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["refreshToken"],
                                    properties: {
                                        refreshToken: { type: "string", format: "uuid" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/auth/logout": {
                post: {
                    tags: ["Auth"],
                    summary: "Logout current session",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["refreshToken"],
                                    properties: {
                                        refreshToken: { type: "string", format: "uuid" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/auth/sessions": {
                get: {
                    tags: ["Session"],
                    summary: "List active sessions for current user",
                    security: [{ bearerAuth: [] }],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/auth/logout-all": {
                post: {
                    tags: ["Session"],
                    summary: "Logout all sessions for current user",
                    security: [{ bearerAuth: [] }],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/auth/admin/unlock-user": {
                post: {
                    tags: ["Session"],
                    summary: "Admin unlock user account",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        email: { type: "string", format: "email" },
                                        mobile: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/auth/otp/send": {
                post: {
                    tags: ["OTP"],
                    summary: "Send OTP to mobile",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["mobile"],
                                    properties: {
                                        mobile: { type: "string" },
                                        channel: { type: "string", enum: ["sms"], default: "sms" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/auth/otp/verify": {
                post: {
                    tags: ["OTP"],
                    summary: "Verify OTP",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["mobile", "otp"],
                                    properties: {
                                        mobile: { type: "string" },
                                        otp: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/academic-years": {
                post: {
                    tags: ["AcademicYear"],
                    summary: "Create academic year",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["label", "startDate", "endDate"],
                                    properties: {
                                        label: { type: "string" },
                                        startDate: { type: "string", format: "date" },
                                        endDate: { type: "string", format: "date" },
                                        isActive: { type: "boolean" },
                                        isLocked: { type: "boolean" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "201": { description: "Created" } },
                },
                get: {
                    tags: ["AcademicYear"],
                    summary: "List academic years",
                    security: [{ bearerAuth: [] }],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/academic-years/{id}": {
                get: {
                    tags: ["AcademicYear"],
                    summary: "Get academic year by id",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
                patch: {
                    tags: ["AcademicYear"],
                    summary: "Update academic year",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        label: { type: "string" },
                                        startDate: { type: "string", format: "date" },
                                        endDate: { type: "string", format: "date" },
                                        isActive: { type: "boolean" },
                                        isLocked: { type: "boolean" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "200": { description: "OK" } },
                },
                delete: {
                    tags: ["AcademicYear"],
                    summary: "Delete academic year",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/classes": {
                post: {
                    tags: ["Class"],
                    summary: "Create class",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["className", "classOrder", "academicYearId"],
                                    properties: {
                                        className: { type: "string" },
                                        classOrder: { type: "integer" },
                                        academicYearId: { type: "string", format: "uuid" },
                                        isHalfDay: { type: "boolean" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "201": { description: "Created" } },
                },
                get: {
                    tags: ["Class"],
                    summary: "List classes",
                    security: [{ bearerAuth: [] }],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/classes/{id}": {
                get: {
                    tags: ["Class"],
                    summary: "Get class by id",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
                patch: {
                    tags: ["Class"],
                    summary: "Update class",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        className: { type: "string" },
                                        classOrder: { type: "integer" },
                                        academicYearId: { type: "string", format: "uuid" },
                                        isHalfDay: { type: "boolean" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "200": { description: "OK" } },
                },
                delete: {
                    tags: ["Class"],
                    summary: "Delete class",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/sections": {
                post: {
                    tags: ["Section"],
                    summary: "Create section",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["classId", "sectionName"],
                                    properties: {
                                        classId: { type: "string", format: "uuid" },
                                        sectionName: { type: "string" },
                                        capacity: { type: "integer" },
                                        classTeacherId: { type: "string", format: "uuid" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "201": { description: "Created" } },
                },
                get: {
                    tags: ["Section"],
                    summary: "List sections",
                    security: [{ bearerAuth: [] }],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/sections/{id}": {
                get: {
                    tags: ["Section"],
                    summary: "Get section by id",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
                patch: {
                    tags: ["Section"],
                    summary: "Update section",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        classId: { type: "string", format: "uuid" },
                                        sectionName: { type: "string" },
                                        capacity: { type: "integer" },
                                        classTeacherId: { type: "string", format: "uuid", nullable: true },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "200": { description: "OK" } },
                },
                delete: {
                    tags: ["Section"],
                    summary: "Delete section",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/subjects": {
                post: {
                    tags: ["Subject"],
                    summary: "Create subject",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["code", "name"],
                                    properties: {
                                        code: { type: "string" },
                                        name: { type: "string" },
                                        isElective: { type: "boolean" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "201": { description: "Created" } },
                },
                get: {
                    tags: ["Subject"],
                    summary: "List subjects",
                    security: [{ bearerAuth: [] }],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/subjects/{id}": {
                get: {
                    tags: ["Subject"],
                    summary: "Get subject by id",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
                patch: {
                    tags: ["Subject"],
                    summary: "Update subject",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        code: { type: "string" },
                                        name: { type: "string" },
                                        isElective: { type: "boolean" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "200": { description: "OK" } },
                },
                delete: {
                    tags: ["Subject"],
                    summary: "Delete subject",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/periods": {
                post: {
                    tags: ["Period"],
                    summary: "Create period",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["periodNumber", "startTime", "endTime"],
                                    properties: {
                                        periodNumber: { type: "integer" },
                                        startTime: { type: "string", example: "09:00" },
                                        endTime: { type: "string", example: "09:40" },
                                        isLunch: { type: "boolean" },
                                        isFirstPeriod: { type: "boolean" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "201": { description: "Created" } },
                },
                get: {
                    tags: ["Period"],
                    summary: "List periods",
                    security: [{ bearerAuth: [] }],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/periods/{id}": {
                get: {
                    tags: ["Period"],
                    summary: "Get period by id",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
                patch: {
                    tags: ["Period"],
                    summary: "Update period",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        periodNumber: { type: "integer" },
                                        startTime: { type: "string", example: "09:00" },
                                        endTime: { type: "string", example: "09:40" },
                                        isLunch: { type: "boolean" },
                                        isFirstPeriod: { type: "boolean" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "200": { description: "OK" } },
                },
                delete: {
                    tags: ["Period"],
                    summary: "Delete period",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/class-subjects": {
                post: {
                    tags: ["ClassSubject"],
                    summary: "Create class subject mapping",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["classId", "subjectId", "periodsPerWeek"],
                                    properties: {
                                        classId: { type: "string", format: "uuid" },
                                        subjectId: { type: "string", format: "uuid" },
                                        periodsPerWeek: { type: "integer" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "201": { description: "Created" } },
                },
                get: {
                    tags: ["ClassSubject"],
                    summary: "List class subject mappings",
                    security: [{ bearerAuth: [] }],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/class-subjects/{id}": {
                get: {
                    tags: ["ClassSubject"],
                    summary: "Get class subject mapping by id",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
                patch: {
                    tags: ["ClassSubject"],
                    summary: "Update class subject mapping",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        classId: { type: "string", format: "uuid" },
                                        subjectId: { type: "string", format: "uuid" },
                                        periodsPerWeek: { type: "integer" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "200": { description: "OK" } },
                },
                delete: {
                    tags: ["ClassSubject"],
                    summary: "Delete class subject mapping",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/teachers": {
                post: {
                    tags: ["Teacher"],
                    summary: "Create teacher",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["employeeId", "fullName"],
                                    properties: {
                                        employeeId: { type: "string" },
                                        fullName: { type: "string" },
                                        designation: { type: "string" },
                                        department: { type: "string" },
                                        joiningDate: { type: "string", format: "date" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "201": { description: "Created" } },
                },
                get: {
                    tags: ["Teacher"],
                    summary: "List teachers",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "page",
                            in: "query",
                            required: false,
                            schema: { type: "integer", minimum: 1 },
                        },
                        {
                            name: "limit",
                            in: "query",
                            required: false,
                            schema: { type: "integer", minimum: 1, maximum: 200 },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/teachers/{id}": {
                get: {
                    tags: ["Teacher"],
                    summary: "Get teacher by id",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
                patch: {
                    tags: ["Teacher"],
                    summary: "Update teacher",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        employeeId: { type: "string" },
                                        fullName: { type: "string" },
                                        designation: { type: "string" },
                                        department: { type: "string" },
                                        joiningDate: { type: "string", format: "date" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "200": { description: "OK" } },
                },
                delete: {
                    tags: ["Teacher"],
                    summary: "Delete teacher (soft delete)",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/teacher-subject-classes": {
                post: {
                    tags: ["TeacherSubjectClass"],
                    summary: "Create teacher-subject-class assignment",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["teacherId", "classSubjectId", "academicYearId"],
                                    properties: {
                                        teacherId: { type: "string", format: "uuid" },
                                        classSubjectId: { type: "string", format: "uuid" },
                                        sectionId: { type: "string", format: "uuid", nullable: true },
                                        academicYearId: { type: "string", format: "uuid" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "201": { description: "Created" } },
                },
                get: {
                    tags: ["TeacherSubjectClass"],
                    summary: "List teacher-subject-class assignments",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "teacherId",
                            in: "query",
                            schema: { type: "string", format: "uuid" },
                        },
                        {
                            name: "classId",
                            in: "query",
                            schema: { type: "string", format: "uuid" },
                        },
                        {
                            name: "sectionId",
                            in: "query",
                            schema: { type: "string", format: "uuid" },
                        },
                        {
                            name: "page",
                            in: "query",
                            required: false,
                            schema: { type: "integer", minimum: 1 },
                        },
                        {
                            name: "limit",
                            in: "query",
                            required: false,
                            schema: { type: "integer", minimum: 1, maximum: 200 },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/students": {
                post: {
                    tags: ["Student"],
                    summary: "Create student",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: [
                                        "registrationNumber",
                                        "fullName",
                                        "dateOfBirth",
                                        "gender",
                                        "enrollment",
                                    ],
                                    properties: {
                                        registrationNumber: { type: "string" },
                                        admissionNumber: { type: "string" },
                                        fullName: { type: "string" },
                                        dateOfBirth: { type: "string", format: "date" },
                                        gender: { type: "string" },
                                        bloodGroup: { type: "string" },
                                        status: { type: "string" },
                                        profile: {
                                            type: "object",
                                            properties: {
                                                profilePhotoUrl: { type: "string" },
                                                address: { type: "string" },
                                                emergencyContactName: { type: "string" },
                                                emergencyContactMobile: { type: "string" },
                                                previousSchool: { type: "string" },
                                                medicalInfo: { type: "object" },
                                            },
                                        },
                                        parentId: { type: "string", format: "uuid" },
                                        parent: {
                                            type: "object",
                                            properties: {
                                                fullName: { type: "string" },
                                                mobile: { type: "string" },
                                                email: { type: "string", format: "email" },
                                                relationToStudent: { type: "string" },
                                                isPrimary: { type: "boolean" },
                                            },
                                        },
                                        enrollment: {
                                            type: "object",
                                            required: ["academicYearId", "classId", "sectionId"],
                                            properties: {
                                                academicYearId: { type: "string", format: "uuid" },
                                                classId: { type: "string", format: "uuid" },
                                                sectionId: { type: "string", format: "uuid" },
                                                rollNumber: { type: "integer" },
                                                isDetained: { type: "boolean" },
                                                promotionStatus: { type: "string" },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "201": { description: "Created" } },
                },
                get: {
                    tags: ["Student"],
                    summary: "List students",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "page",
                            in: "query",
                            required: false,
                            schema: { type: "integer", minimum: 1 },
                        },
                        {
                            name: "limit",
                            in: "query",
                            required: false,
                            schema: { type: "integer", minimum: 1, maximum: 200 },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/students/{id}": {
                get: {
                    tags: ["Student"],
                    summary: "Get student by id",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
                patch: {
                    tags: ["Student"],
                    summary: "Update student",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        registrationNumber: { type: "string" },
                                        admissionNumber: { type: "string" },
                                        fullName: { type: "string" },
                                        dateOfBirth: { type: "string", format: "date" },
                                        gender: { type: "string" },
                                        bloodGroup: { type: "string" },
                                        status: { type: "string" },
                                        profile: {
                                            type: "object",
                                            properties: {
                                                profilePhotoUrl: { type: "string" },
                                                address: { type: "string" },
                                                emergencyContactName: { type: "string" },
                                                emergencyContactMobile: { type: "string" },
                                                previousSchool: { type: "string" },
                                                medicalInfo: { type: "object" },
                                            },
                                        },
                                        parentId: { type: "string", format: "uuid" },
                                        parent: {
                                            type: "object",
                                            properties: {
                                                fullName: { type: "string" },
                                                mobile: { type: "string" },
                                                email: { type: "string", format: "email" },
                                                relationToStudent: { type: "string" },
                                                isPrimary: { type: "boolean" },
                                            },
                                        },
                                        enrollment: {
                                            type: "object",
                                            properties: {
                                                academicYearId: { type: "string", format: "uuid" },
                                                classId: { type: "string", format: "uuid" },
                                                sectionId: { type: "string", format: "uuid" },
                                                rollNumber: { type: "integer" },
                                                isDetained: { type: "boolean" },
                                                promotionStatus: { type: "string" },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "200": { description: "OK" } },
                },
                delete: {
                    tags: ["Student"],
                    summary: "Delete student (soft delete)",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string", format: "uuid" },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/student-attendance": {
                post: {
                    tags: ["StudentAttendance"],
                    summary: "Mark student attendance",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["sectionId", "academicYearId", "timetableSlotId", "records"],
                                    properties: {
                                        sectionId: { type: "string", format: "uuid" },
                                        academicYearId: { type: "string", format: "uuid" },
                                        timetableSlotId: { type: "string", format: "uuid" },
                                        attendanceDate: { type: "string", format: "date" },
                                        markedByTeacherId: { type: "string", format: "uuid" },
                                        records: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                required: ["studentId", "status"],
                                                properties: {
                                                    studentId: { type: "string", format: "uuid" },
                                                    status: {
                                                        type: "string",
                                                        enum: ["PRESENT", "ABSENT", "LATE", "HALF_DAY"],
                                                    },
                                                    remarks: { type: "string" },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "201": { description: "Created" } },
                },
                get: {
                    tags: ["StudentAttendance"],
                    summary: "List attendance records",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: "studentId", in: "query", schema: { type: "string", format: "uuid" } },
                        { name: "sectionId", in: "query", schema: { type: "string", format: "uuid" } },
                        {
                            name: "academicYearId",
                            in: "query",
                            schema: { type: "string", format: "uuid" },
                        },
                        { name: "fromDate", in: "query", schema: { type: "string", format: "date" } },
                        { name: "toDate", in: "query", schema: { type: "string", format: "date" } },
                        {
                            name: "page",
                            in: "query",
                            required: false,
                            schema: { type: "integer", minimum: 1 },
                        },
                        {
                            name: "limit",
                            in: "query",
                            required: false,
                            schema: { type: "integer", minimum: 1, maximum: 200 },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/student-attendance/{id}": {
                get: {
                    tags: ["StudentAttendance"],
                    summary: "Get attendance record by id",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
                    ],
                    responses: { "200": { description: "OK" } },
                },
                patch: {
                    tags: ["StudentAttendance"],
                    summary: "Update attendance record",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        status: {
                                            type: "string",
                                            enum: ["PRESENT", "ABSENT", "LATE", "HALF_DAY"],
                                        },
                                        remarks: { type: "string", nullable: true },
                                        correctionReason: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/student-bulk-imports": {
                post: {
                    tags: ["StudentBulkImport"],
                    summary: "Bulk import students from CSV or Excel",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "text/csv": {
                                schema: { type: "string", format: "binary" },
                            },
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
                                schema: { type: "string", format: "binary" },
                            },
                            "application/vnd.ms-excel": {
                                schema: { type: "string", format: "binary" },
                            },
                        },
                    },
                    parameters: [
                        {
                            name: "batchSize",
                            in: "query",
                            required: false,
                            schema: { type: "integer", minimum: 1, maximum: 500 },
                        },
                    ],
                    responses: { "201": { description: "Created" } },
                },
            },
            "/api/v1/teacher-subject-classes/{id}": {
                get: {
                    tags: ["TeacherSubjectClass"],
                    summary: "Get teacher-subject-class assignment by id",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
                    ],
                    responses: { "200": { description: "OK" } },
                },
                patch: {
                    tags: ["TeacherSubjectClass"],
                    summary: "Update teacher-subject-class assignment",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        teacherId: { type: "string", format: "uuid" },
                                        classSubjectId: { type: "string", format: "uuid" },
                                        sectionId: { type: "string", format: "uuid", nullable: true },
                                        academicYearId: { type: "string", format: "uuid" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "200": { description: "OK" } },
                },
                delete: {
                    tags: ["TeacherSubjectClass"],
                    summary: "Delete teacher-subject-class assignment",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
                    ],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/timetable-slots": {
                post: {
                    tags: ["TimetableSlot"],
                    summary: "Create timetable slot",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: [
                                        "sectionId",
                                        "classSubjectId",
                                        "academicYearId",
                                        "dayOfWeek",
                                        "periodId",
                                    ],
                                    properties: {
                                        sectionId: { type: "string", format: "uuid" },
                                        classSubjectId: { type: "string", format: "uuid" },
                                        teacherId: { type: "string", format: "uuid", nullable: true },
                                        academicYearId: { type: "string", format: "uuid" },
                                        dayOfWeek: { type: "integer", example: 1 },
                                        periodId: { type: "string", format: "uuid" },
                                        roomNo: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "201": { description: "Created" } },
                },
                get: {
                    tags: ["TimetableSlot"],
                    summary: "List timetable slots",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: "page",
                            in: "query",
                            required: false,
                            schema: { type: "integer", minimum: 1 },
                        },
                        {
                            name: "limit",
                            in: "query",
                            required: false,
                            schema: { type: "integer", minimum: 1, maximum: 200 },
                        },
                    ],
                    responses: { "200": { description: "OK" } },
                },
            },
            "/api/v1/timetable-slots/{id}": {
                get: {
                    tags: ["TimetableSlot"],
                    summary: "Get timetable slot by id",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
                    ],
                    responses: { "200": { description: "OK" } },
                },
                patch: {
                    tags: ["TimetableSlot"],
                    summary: "Update timetable slot",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        sectionId: { type: "string", format: "uuid" },
                                        classSubjectId: { type: "string", format: "uuid" },
                                        teacherId: { type: "string", format: "uuid", nullable: true },
                                        academicYearId: { type: "string", format: "uuid" },
                                        dayOfWeek: { type: "integer", example: 1 },
                                        periodId: { type: "string", format: "uuid" },
                                        roomNo: { type: "string", nullable: true },
                                    },
                                },
                            },
                        },
                    },
                    responses: { "200": { description: "OK" } },
                },
                delete: {
                    tags: ["TimetableSlot"],
                    summary: "Delete timetable slot",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
                    ],
                    responses: { "200": { description: "OK" } },
                },
            },
        },
    },
    apis: [],
};
export const swaggerSpec = swaggerJSDoc(options);

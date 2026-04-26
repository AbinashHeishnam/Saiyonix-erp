import { ApiError } from "@/utils/apiError";
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function collectUnknownKeys(original, parsed, path = []) {
    if (Array.isArray(original) && Array.isArray(parsed)) {
        const unknowns = [];
        const max = Math.min(original.length, parsed.length);
        for (let i = 0; i < max; i += 1) {
            unknowns.push(...collectUnknownKeys(original[i], parsed[i], [...path, `[${i}]`]));
        }
        return unknowns;
    }
    if (isPlainObject(original) && isPlainObject(parsed)) {
        const unknowns = [];
        for (const key of Object.keys(original)) {
            if (!(key in parsed)) {
                unknowns.push([...path, key].join("."));
                continue;
            }
            unknowns.push(...collectUnknownKeys(original[key], parsed[key], [...path, key]));
        }
        return unknowns;
    }
    return [];
}
function isZodSchema(value) {
    return typeof value === "object" && value !== null && "safeParse" in value;
}
const LOG_VALIDATION = process.env.LOG_VALIDATION === "true" || process.env.NODE_ENV !== "production";
export function validate(schema) {
    return (req, _res, next) => {
        if (LOG_VALIDATION) {
            console.log("[validate] start", req.method, req.originalUrl);
        }
        const errors = [];
        const canAssignKey = (key) => {
            let target = req;
            while (target && typeof target === "object") {
                const descriptor = Object.getOwnPropertyDescriptor(target, key);
                if (descriptor) {
                    return Boolean(descriptor.set) || Boolean(descriptor.writable);
                }
                target = Object.getPrototypeOf(target);
            }
            return true;
        };
        const assignIfWritable = (key, value) => {
            const canAssign = canAssignKey(key);
            if (canAssign) {
                req[key] = value;
                return;
            }
            // Fall back to mutating the existing object when possible (Express 5 getter-only props).
            const existing = req[key];
            if (isPlainObject(existing) && isPlainObject(value)) {
                for (const existingKey of Object.keys(existing)) {
                    delete existing[existingKey];
                }
                Object.assign(existing, value);
            }
        };
        const validatePart = (source, value, partSchema) => {
            if (!partSchema) {
                return value;
            }
            const result = partSchema.safeParse(value);
            if (!result.success) {
                errors.push({ source, issues: result.error.issues, unknownKeys: [] });
                return value;
            }
            const unknownKeys = collectUnknownKeys(value, result.data);
            if (unknownKeys.length > 0) {
                errors.push({ source, issues: [], unknownKeys });
            }
            return result.data;
        };
        if (isZodSchema(schema)) {
            const nextBody = validatePart("body", req.body, schema);
            assignIfWritable("body", nextBody);
        }
        else {
            const nextBody = validatePart("body", req.body, schema.body);
            const nextParams = validatePart("params", req.params, schema.params);
            const nextQuery = validatePart("query", req.query, schema.query);
            assignIfWritable("body", nextBody);
            assignIfWritable("params", nextParams);
            assignIfWritable("query", nextQuery);
        }
        if (errors.length > 0) {
            if (LOG_VALIDATION) {
                console.log("[validate] failed", errors);
            }
            return next(new ApiError(400, "Validation failed", {
                errors,
            }));
        }
        if (LOG_VALIDATION) {
            console.log("[validate] ok");
        }
        return next();
    };
}

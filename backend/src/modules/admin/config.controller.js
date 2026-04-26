import prisma from "@/core/db/prisma";
import { success } from "@/utils/apiResponse";
import { invalidateConfigCache } from "@/core/services/appConfig.service";
import { logger } from "@/utils/logger";
export async function listAppConfigs(req, res, next) {
    try {
        const configs = await prisma.appConfig.findMany({
            orderBy: { key: "asc" },
        });
        return success(res, configs, "Configs fetched successfully");
    }
    catch (error) {
        return next(error);
    }
}
export async function upsertAppConfig(req, res, next) {
    try {
        const { key, value } = req.body;
        logger.info("[config] upsert request", {
            key,
            value: value ? "[REDACTED]" : value,
        });
        if (!key || typeof key !== "string" || !key.trim()) {
            return res.status(400).json({
                message: "key is required",
            });
        }
        if (!value || typeof value !== "string" || !value.trim()) {
            return res.status(400).json({
                message: "value is required",
            });
        }
        const normalizedKey = key.trim();
        const normalizedValue = value.trim();
        const record = await prisma.appConfig.upsert({
            where: { key: normalizedKey },
            create: { key: normalizedKey, value: normalizedValue },
            update: { value: normalizedValue },
        });
        logger.info("[config] upsert success", {
            id: record.id,
            key: record.key,
        });
        invalidateConfigCache();
        return success(res, record, "Config saved successfully");
    }
    catch (error) {
        return next(error);
    }
}

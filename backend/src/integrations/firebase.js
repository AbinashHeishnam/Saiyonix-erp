import admin from "firebase-admin";
import { z } from "zod";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";
const serviceAccountSchema = z
    .object({
    project_id: z.string().min(1),
    client_email: z.string().min(1),
    private_key: z.string().min(1),
})
    .passthrough();
let firebaseApp = null;
let warnedMisconfigured = false;
function normalizePrivateKey(value) {
    // Common deployment pattern: private key is stored with literal "\n".
    return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}
function loadServiceAccountFromEnv() {
    const json = env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    if (json) {
        try {
            const parsed = JSON.parse(json);
            const validated = serviceAccountSchema.safeParse(parsed);
            if (!validated.success) {
                throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON shape");
            }
            return {
                ...validated.data,
                private_key: normalizePrivateKey(validated.data.private_key),
            };
        }
        catch (error) {
            logger.error("[firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON", error);
            return null;
        }
    }
    const projectId = env.FIREBASE_PROJECT_ID?.trim();
    const clientEmail = env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKey = env.FIREBASE_PRIVATE_KEY?.trim();
    if (!projectId || !clientEmail || !privateKey) {
        return null;
    }
    return {
        project_id: projectId,
        client_email: clientEmail,
        private_key: normalizePrivateKey(privateKey),
    };
}
export function isFirebaseConfigured() {
    return Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON ||
        (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY));
}
export function getFirebaseAdminApp() {
    if (firebaseApp) {
        return firebaseApp;
    }
    if (!isFirebaseConfigured()) {
        if (!warnedMisconfigured) {
            warnedMisconfigured = true;
            logger.warn("[firebase] Firebase Admin not configured; FCM delivery will be skipped.");
        }
        return null;
    }
    const serviceAccount = loadServiceAccountFromEnv();
    if (!serviceAccount) {
        if (!warnedMisconfigured) {
            warnedMisconfigured = true;
            logger.warn("[firebase] Firebase Admin misconfigured; FCM delivery will be skipped.");
        }
        return null;
    }
    try {
        // Avoid re-init in watch mode / worker reloads.
        if (admin.apps.length > 0) {
            firebaseApp = admin.apps[0];
            return firebaseApp;
        }
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id,
        });
        logger.info("[firebase] Firebase Admin initialized");
        return firebaseApp;
    }
    catch (error) {
        logger.error("[firebase] Firebase Admin initialization failed", error);
        return null;
    }
}
export function getFirebaseMessaging() {
    const app = getFirebaseAdminApp();
    if (!app)
        return null;
    return admin.messaging(app);
}

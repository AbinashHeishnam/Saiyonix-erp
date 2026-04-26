import fs from "node:fs/promises";
import path from "node:path";
import { buildSchoolHeaderLines } from "@/utils/schoolBranding";
const DEFAULT_META_COLOR = "#555";
function sanitizeLogoUrl(raw) {
    if (!raw)
        return null;
    const trimmed = raw.trim();
    if (!trimmed)
        return null;
    if (/^https?:\/\//i.test(trimmed)) {
        try {
            const url = new URL(trimmed);
            if (url.pathname.startsWith("/api/v1/files/secure")) {
                const nested = url.searchParams.get("fileUrl");
                return nested ? decodeURIComponent(nested) : null;
            }
            return trimmed;
        }
        catch {
            return null;
        }
    }
    if (trimmed.startsWith("/api/v1/files/secure")) {
        try {
            const url = new URL(`http://localhost${trimmed}`);
            const nested = url.searchParams.get("fileUrl");
            return nested ? decodeURIComponent(nested) : null;
        }
        catch {
            return null;
        }
    }
    return trimmed;
}
async function readLocalFile(fileUrl) {
    if (fileUrl.startsWith("/storage/")) {
        const filePath = path.join(process.cwd(), fileUrl.replace(/^\/storage\//, "storage/"));
        return fs.readFile(filePath);
    }
    if (fileUrl.startsWith("/uploads/")) {
        const filePath = path.join(process.cwd(), fileUrl.replace(/^\/uploads\//, "uploads/"));
        return fs.readFile(filePath);
    }
    return null;
}
async function fetchLogoBuffer(rawUrl) {
    const logoUrl = sanitizeLogoUrl(rawUrl);
    if (!logoUrl)
        return null;
    const ext = path.extname(logoUrl).toLowerCase();
    if (ext === ".svg") {
        return null;
    }
    if (/^https?:\/\//i.test(logoUrl)) {
        try {
            const response = await fetch(logoUrl);
            if (!response.ok)
                return null;
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }
        catch {
            return null;
        }
    }
    try {
        return await readLocalFile(logoUrl);
    }
    catch {
        return null;
    }
}
export async function documentHeaderBuilder(doc, branding, options = {}) {
    const { title, layout = "inline", logoSize = 46, nameFontSize = 18, metaFontSize = 9, titleFontSize = 16, metaColor = DEFAULT_META_COLOR, titleColor = "#000", divider = false, dividerColor = "#94a3b8", gapAfter = 0.6, logoGap = 12, extraLines = [], } = options;
    const marginLeft = doc.page.margins.left ?? 40;
    const marginRight = doc.page.margins.right ?? marginLeft;
    const availableWidth = doc.page.width - marginLeft - marginRight;
    const startY = doc.y;
    const logoBuffer = await fetchLogoBuffer(branding.logoUrl ?? null);
    const metaLines = [
        ...buildSchoolHeaderLines(branding),
        ...extraLines.filter(Boolean),
    ];
    if (layout === "stacked") {
        if (logoBuffer) {
            const logoX = marginLeft + (availableWidth - logoSize) / 2;
            doc.image(logoBuffer, logoX, startY, { fit: [logoSize, logoSize] });
            doc.y = startY + logoSize + 6;
        }
        doc.font("Helvetica-Bold")
            .fontSize(nameFontSize)
            .fillColor("#000")
            .text(branding.schoolName, marginLeft, doc.y, { width: availableWidth, align: "center" });
        if (metaLines.length) {
            doc.moveDown(0.3);
            doc.font("Helvetica")
                .fontSize(metaFontSize)
                .fillColor(metaColor)
                .text(metaLines.join("  |  "), marginLeft, doc.y, { width: availableWidth, align: "center" });
        }
    }
    else {
        let textX = marginLeft;
        let textWidth = availableWidth;
        if (logoBuffer) {
            doc.image(logoBuffer, marginLeft, startY, { fit: [logoSize, logoSize] });
            textX = marginLeft + logoSize + logoGap;
            textWidth = availableWidth - logoSize - logoGap;
        }
        doc.font("Helvetica-Bold")
            .fontSize(nameFontSize)
            .fillColor("#000")
            .text(branding.schoolName, textX, startY + 2, { width: textWidth, align: logoBuffer ? "left" : "center" });
        if (metaLines.length) {
            doc.moveDown(0.3);
            doc.font("Helvetica")
                .fontSize(metaFontSize)
                .fillColor(metaColor)
                .text(metaLines.join("  |  "), textX, doc.y, { width: textWidth, align: logoBuffer ? "left" : "center" });
        }
        const minY = startY + (logoBuffer ? logoSize : 0);
        if (doc.y < minY) {
            doc.y = minY;
        }
    }
    doc.fillColor("#000");
    if (title) {
        doc.moveDown(0.6);
        doc.font("Helvetica-Bold")
            .fontSize(titleFontSize)
            .fillColor(titleColor)
            .text(title, { align: "center" });
    }
    if (divider) {
        doc.moveDown(0.4);
        doc.moveTo(marginLeft, doc.y).lineTo(marginLeft + availableWidth, doc.y).stroke(dividerColor);
    }
    doc.moveDown(gapAfter);
}

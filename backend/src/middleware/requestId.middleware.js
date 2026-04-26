import { v4 as uuidv4 } from "uuid";
export function requestIdMiddleware(req, res, next) {
    const requestId = uuidv4();
    req.requestId = requestId;
    res.setHeader("X-Request-ID", requestId);
    next();
}

export function success(res, data, message = "OK", status = 200, pagination) {
    return res.status(status).json({
        success: true,
        data,
        message,
        pagination,
    });
}
export function error(res, message, status = 500, data, pagination) {
    return res.status(status).json({
        success: false,
        data,
        message,
        pagination,
    });
}

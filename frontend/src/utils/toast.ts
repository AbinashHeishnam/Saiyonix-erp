import toast from "react-hot-toast";

/**
 * Optimized export for standard toast usage
 */
export const toastUtils = {
    success: (msg: string) => toast.success(msg),
    error: (msg: string) => toast.error(msg),
    loading: (msg: string) => toast.loading(msg),
    dismiss: (id?: string) => toast.dismiss(id),
};

export { toast };
export default toast;

import Modal from "./Modal";
import Button from "./Button";

interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "primary";
}

export default function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "primary",
}: ConfirmDialogProps) {
    return (
        <Modal open={open} onClose={onClose} title={title} size="sm">
            <div className="flex flex-col gap-4">
                <p className="text-sm text-slate-600">{message}</p>
                <div className="flex justify-end gap-3 mt-2">
                    <Button variant="ghost" onClick={onClose}>
                        {cancelText}
                    </Button>
                    <Button
                        variant={variant === "danger" ? "danger" : "primary"}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

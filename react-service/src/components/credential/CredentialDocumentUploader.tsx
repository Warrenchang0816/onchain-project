import { useId, useMemo, useEffect } from "react";

type Props = {
    label: string;
    helperText?: string;
    file: File | null;
    onChange: (file: File | null) => void;
    required?: boolean;
};

export default function CredentialDocumentUploader(props: Props) {
    const inputId = useId();

    // Derive object URL from the file via useMemo so it's recomputed only when file changes.
    const previewUrl = useMemo<string | null>(() => {
        if (!props.file) return null;
        return URL.createObjectURL(props.file);
    }, [props.file]);

    // Revoke the previous URL when it changes or on unmount.
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    return (
        <div className="space-y-2 rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                    <label htmlFor={inputId} className="text-sm font-semibold text-on-surface">
                        {props.label}
                        {props.required ? <span className="ml-1 text-error">*</span> : null}
                    </label>
                    {props.helperText ? (
                        <p className="text-xs leading-[1.7] text-on-surface-variant">{props.helperText}</p>
                    ) : null}
                </div>
                <label
                    htmlFor={inputId}
                    className="inline-flex cursor-pointer items-center rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface"
                >
                    選擇檔案
                </label>
            </div>

            <input
                id={inputId}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => props.onChange(event.target.files?.[0] ?? null)}
            />

            <div className="rounded-xl bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
                {props.file ? props.file.name : "尚未選擇檔案"}
            </div>

            {previewUrl ? (
                <div className="onboarding-file-preview-shell">
                    <img src={previewUrl} alt="預覽" className="onboarding-file-preview-image" />
                </div>
            ) : null}
        </div>
    );
}

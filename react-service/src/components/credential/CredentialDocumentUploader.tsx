import { useEffect, useId, useMemo } from "react";

type Props = {
    label: string;
    helperText?: string;
    file: File | null;
    onChange: (file: File | null) => void;
    required?: boolean;
};

export default function CredentialDocumentUploader(props: Props) {
    const inputId = useId();
    const previewUrl = useMemo(() => (props.file ? URL.createObjectURL(props.file) : null), [props.file]);

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    return (
        <div className="space-y-3 rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
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
                    className="inline-flex cursor-pointer items-center rounded-xl border border-outline-variant/20 bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container"
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

            <div className="rounded-xl bg-surface px-3 py-2 text-sm text-on-surface-variant">
                {props.file ? props.file.name : "尚未選擇檔案"}
            </div>

            {previewUrl ? (
                <div className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-[20px] border border-outline-variant/15 bg-white px-4 py-4">
                    <img src={previewUrl} alt={`${props.label}預覽`} className="block max-h-[360px] w-full object-contain" />
                </div>
            ) : null}
        </div>
    );
}

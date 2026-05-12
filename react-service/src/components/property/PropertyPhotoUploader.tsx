import { useRef, useState } from "react";
import { deleteAttachment, uploadPropertyPhoto } from "@/api/propertyApi";
import PropertyPhotoGallery from "./PropertyPhotoGallery";

const MAX_PHOTOS = 10;

type Props = {
    propertyId: number;
    photos: string[];
    attachmentIds: number[];
    onUploaded: () => void;
};

export default function PropertyPhotoUploader({ propertyId, photos, attachmentIds, onUploaded }: Props) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    const atLimit = photos.length >= MAX_PHOTOS;

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError("");
        try {
            await uploadPropertyPhoto(propertyId, file);
            onUploaded();
        } catch (err) {
            setError(err instanceof Error ? err.message : "上傳失敗");
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const handleDelete = async (attachmentId: number) => {
        setError("");
        try {
            await deleteAttachment(propertyId, attachmentId);
            onUploaded();
        } catch (err) {
            setError(err instanceof Error ? err.message : "刪除失敗");
        }
    };

    return (
        <div className="space-y-4">
            <PropertyPhotoGallery photos={photos} />

            {/* Thumbnail strip with delete buttons */}
            {photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {photos.map((url, idx) => (
                        <div key={attachmentIds[idx]} className="relative">
                            <img
                                src={url}
                                alt={`照片 ${idx + 1}`}
                                className="h-16 w-24 rounded-lg object-cover"
                            />
                            <button
                                type="button"
                                aria-label={`刪除照片 ${idx + 1}`}
                                onClick={() => {
                                    const id = attachmentIds[idx];
                                    if (id !== undefined) void handleDelete(id);
                                }}
                                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-error text-xs font-bold text-white"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload control */}
            <div>
                {atLimit ? (
                    <p className="text-xs text-on-surface-variant">已達上限（{MAX_PHOTOS} 張）</p>
                ) : (
                    <label
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface ${uploading ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                        <span className="material-symbols-outlined text-base">add_photo_alternate</span>
                        {uploading ? "上傳中..." : `新增照片（${photos.length} / ${MAX_PHOTOS}）`}
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploading || atLimit}
                            onChange={(e) => void handleFile(e)}
                        />
                    </label>
                )}
                {error && <p className="mt-2 text-sm text-error">{error}</p>}
            </div>
        </div>
    );
}

import { useState } from "react";

type Props = {
    photos: string[];
    className?: string;
};

export default function PropertyPhotoGallery({ photos, className = "" }: Props) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    if (photos.length === 0) {
        return (
            <div
                className={`flex items-center justify-center rounded-2xl border border-outline-variant/15 bg-surface-container-lowest ${className}`}
                style={{ height: "320px" }}
            >
                <div className="flex flex-col items-center gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-5xl">photo_camera</span>
                    <span className="text-sm">暫無照片</span>
                </div>
            </div>
        );
    }

    const safeIndex = Math.min(selectedIndex, photos.length - 1);

    return (
        <div className={`overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-lowest ${className}`}>
            {/* Hero */}
            <div className="relative w-full overflow-hidden" style={{ height: "420px" }}>
                <img
                    src={photos[safeIndex]}
                    alt={`物件照片 ${safeIndex + 1}`}
                    className="h-full w-full object-cover"
                />
                <div className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white">
                    {safeIndex + 1} / {photos.length}
                </div>
            </div>
            {/* Thumbnails */}
            {photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto bg-surface-container-low p-3">
                    {photos.map((url, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedIndex(idx)}
                            className={`shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                                idx === safeIndex
                                    ? "border-primary-container"
                                    : "border-transparent hover:border-outline-variant/40"
                            }`}
                        >
                            <img
                                src={url}
                                alt={`縮圖 ${idx + 1}`}
                                className="h-16 w-24 object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

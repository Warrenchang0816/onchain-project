type Props = {
    src: string;
    alt: string;
    className?: string;
};

const WATERMARK_TEXT = "僅供本平台媒合使用，非官方驗證文件";

export default function WatermarkedDocumentPreview(props: Props) {
    return (
        <div className={`relative overflow-hidden rounded-[20px] border border-outline-variant/15 bg-white ${props.className ?? ""}`}>
            <img src={props.src} alt={props.alt} className="block max-h-[360px] w-full object-contain px-4 py-4" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="-rotate-12 rounded-xl border border-error/30 bg-white/75 px-6 py-3 text-center text-sm font-extrabold tracking-[0.18em] text-error shadow-sm backdrop-blur-sm">
                    {WATERMARK_TEXT}
                </div>
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-lg bg-black/60 px-3 py-2 text-xs leading-[1.6] text-white">
                本文件由使用者自行提供，平台僅作為媒合資訊揭露與留存管道，不代表官方或第三方專業單位已驗證其真實性、完整性或法律效力。
            </div>
        </div>
    );
}

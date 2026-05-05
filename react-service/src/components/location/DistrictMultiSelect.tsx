import { useEffect, useMemo, useRef, useState } from "react";
import type { TaiwanDistrictOption } from "../../api/listingApi";
import {
    encodeDistrictToken,
    getDistrictSelectionSummary,
    groupDistrictOptions,
    toggleDistrictSelection,
    type DistrictSelection,
    type DistrictSelectionMode,
} from "./districtSelection";

type DistrictMultiSelectProps = {
    options: TaiwanDistrictOption[];
    value: DistrictSelection[];
    mode?: DistrictSelectionMode;
    emptyLabel?: string;
    onChange: (next: DistrictSelection[]) => void;
};

export default function DistrictMultiSelect({
    options,
    value,
    mode = "multi",
    emptyLabel = "不限行政區",
    onChange,
}: DistrictMultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeCounty, setActiveCounty] = useState("");
    const rootRef = useRef<HTMLDivElement>(null);
    const groups = useMemo(() => groupDistrictOptions(options), [options]);
    const selectedCounty = value[0]?.county ?? groups[0]?.county ?? "";
    const visibleCounty = activeCounty || selectedCounty;
    const visibleDistricts = groups.find((group) => group.county === visibleCounty)?.districts ?? [];
    const selectedTokens = useMemo(() => new Set(value.map(encodeDistrictToken)), [value]);
    const label = value.length === 0 ? emptyLabel : getDistrictSelectionSummary(value);

    useEffect(() => {
        if (!activeCounty && selectedCounty) {
            setActiveCounty(selectedCounty);
        }
    }, [activeCounty, selectedCounty]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, []);

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                className="flex w-full items-center justify-between rounded-xl border border-outline-variant/15 bg-surface px-4 py-3 text-left text-sm text-on-surface outline-none transition-colors focus:ring-2 focus:ring-primary-container"
            >
                <span>{label}</span>
                <span className="material-symbols-outlined text-base text-on-surface-variant">expand_more</span>
            </button>

            {isOpen ? (
                <div className="absolute left-0 top-[calc(100%+4px)] z-50 grid w-[min(560px,calc(100vw-3rem))] grid-cols-[160px_1fr] overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-lowest shadow-xl">
                    <div className="max-h-80 overflow-y-auto border-r border-outline-variant/15 bg-surface-container-low">
                        <button
                            type="button"
                            onClick={() => onChange([])}
                            className={`block w-full px-4 py-3 text-left text-sm font-bold ${
                                value.length === 0 ? "bg-primary-container text-on-primary-container" : "text-on-surface hover:bg-surface-container"
                            }`}
                        >
                            {emptyLabel}
                        </button>
                        {groups.map((group) => (
                            <button
                                key={group.county}
                                type="button"
                                onMouseEnter={() => setActiveCounty(group.county)}
                                onClick={() => setActiveCounty(group.county)}
                                className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm ${
                                    visibleCounty === group.county
                                        ? "bg-surface-container-lowest font-bold text-primary-container"
                                        : "text-on-surface hover:bg-surface-container"
                                }`}
                            >
                                <span>{group.county}</span>
                                <span className="material-symbols-outlined text-base">chevron_right</span>
                            </button>
                        ))}
                    </div>

                    <div className="max-h-80 overflow-y-auto bg-surface-container-lowest p-2">
                        {visibleDistricts.map((option) => {
                            const token = encodeDistrictToken(option);
                            const checked = selectedTokens.has(token);
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => {
                                        onChange(toggleDistrictSelection(value, option, mode));
                                        if (mode === "single") setIsOpen(false);
                                    }}
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container-low"
                                >
                                    <span
                                        className={`grid h-5 w-5 place-items-center rounded border ${
                                            checked ? "border-primary-container bg-primary-container text-on-primary-container" : "border-outline-variant/60 bg-surface"
                                        }`}
                                    >
                                        {checked ? <span className="material-symbols-outlined text-sm">check</span> : null}
                                    </span>
                                    <span>{`${option.district} (${option.postal_code})`}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

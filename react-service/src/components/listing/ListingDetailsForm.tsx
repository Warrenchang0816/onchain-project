import { useMemo, useState, type ReactNode } from "react";
import type { Listing } from "../../api/listingApi";
import {
    listingToRentDetailValues,
    listingToSaleDetailValues,
    rentDetailValuesToPayload,
    saleDetailValuesToPayload,
    type RentDetailValues,
    type SaleDetailValues,
} from "./listingDetailValues";

type ListingDetailsFormProps =
    | {
          mode: "rent";
          listing: Listing;
          submitting: boolean;
          onSubmit: (payload: ReturnType<typeof rentDetailValuesToPayload>) => Promise<void> | void;
          onCancel: () => void;
      }
    | {
          mode: "sale";
          listing: Listing;
          submitting: boolean;
          onSubmit: (payload: ReturnType<typeof saleDetailValuesToPayload>) => Promise<void> | void;
          onCancel: () => void;
      };

type SharedDetailKey =
    | "title"
    | "description"
    | "address"
    | "district"
    | "price"
    | "areaPing"
    | "floor"
    | "totalFloors"
    | "roomCount"
    | "bathroomCount"
    | "isPetAllowed"
    | "isParkingIncluded";

const inputCls =
    "block w-full rounded-lg border-0 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-colors placeholder:text-outline focus:ring-2 focus:ring-primary-container";

const checkboxLabelCls = "flex cursor-pointer items-center gap-2 text-sm text-on-surface-variant";

function Field(props: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface-variant">{props.label}</label>
            {props.children}
        </div>
    );
}

function isPositiveNumber(value: string): boolean {
    return Number(value) > 0;
}

function isNonNegativeNumber(value: string): boolean {
    return value.trim() !== "" && Number(value) >= 0;
}

function hasSharedRequired(values: RentDetailValues | SaleDetailValues): boolean {
    return (
        values.title.trim() !== "" &&
        values.address.trim() !== "" &&
        isPositiveNumber(values.price) &&
        isPositiveNumber(values.areaPing) &&
        isNonNegativeNumber(values.roomCount) &&
        isNonNegativeNumber(values.bathroomCount)
    );
}

export default function ListingDetailsForm(props: ListingDetailsFormProps) {
    const [rentForm, setRentForm] = useState<RentDetailValues>(() => listingToRentDetailValues(props.listing));
    const [saleForm, setSaleForm] = useState<SaleDetailValues>(() => listingToSaleDetailValues(props.listing));
    const [error, setError] = useState("");

    const canSubmit = useMemo(() => {
        if (props.mode === "rent") {
            return (
                hasSharedRequired(rentForm) &&
                isPositiveNumber(rentForm.monthlyRent) &&
                isNonNegativeNumber(rentForm.depositMonths) &&
                isNonNegativeNumber(rentForm.managementFeeMonthly) &&
                isPositiveNumber(rentForm.minimumLeaseMonths)
            );
        }

        return hasSharedRequired(saleForm) && isPositiveNumber(saleForm.saleTotalPrice);
    }, [props.mode, rentForm, saleForm]);

    const setRentField = <K extends keyof RentDetailValues>(key: K, value: RentDetailValues[K]) => {
        setRentForm((current) => ({ ...current, [key]: value }));
    };

    const setSaleField = <K extends keyof SaleDetailValues>(key: K, value: SaleDetailValues[K]) => {
        setSaleForm((current) => ({ ...current, [key]: value }));
    };

    const handleSubmit = async () => {
        try {
            setError("");
            if (props.mode === "rent") {
                await props.onSubmit(rentDetailValuesToPayload(rentForm));
                return;
            }
            await props.onSubmit(saleDetailValuesToPayload(saleForm));
        } catch (err) {
            setError(err instanceof Error ? err.message : "儲存刊登明細失敗");
        }
    };

    const shared = props.mode === "rent" ? rentForm : saleForm;
    const setSharedField = (key: SharedDetailKey, value: string | boolean) => {
        if (props.mode === "rent") {
            setRentForm((current) => ({ ...current, [key]: value }));
            return;
        }
        setSaleForm((current) => ({ ...current, [key]: value }));
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="標題">
                    <input className={inputCls} value={shared.title} onChange={(e) => setSharedField("title", e.target.value)} />
                </Field>
                <Field label="行政區">
                    <input className={inputCls} value={shared.district} onChange={(e) => setSharedField("district", e.target.value)} />
                </Field>
            </div>

            <Field label="地址">
                <input className={inputCls} value={shared.address} onChange={(e) => setSharedField("address", e.target.value)} />
            </Field>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label={props.mode === "rent" ? "列表價格 / 月租" : "列表價格 / 總價"}>
                    <input type="number" min={1} className={inputCls} value={shared.price} onChange={(e) => setSharedField("price", e.target.value)} />
                </Field>
                <Field label="權狀或刊登坪數">
                    <input type="number" min={0} className={inputCls} value={shared.areaPing} onChange={(e) => setSharedField("areaPing", e.target.value)} />
                </Field>
                <Field label="所在樓層">
                    <input type="number" className={inputCls} value={shared.floor} onChange={(e) => setSharedField("floor", e.target.value)} />
                </Field>
                <Field label="總樓層">
                    <input type="number" min={0} className={inputCls} value={shared.totalFloors} onChange={(e) => setSharedField("totalFloors", e.target.value)} />
                </Field>
                <Field label="房數">
                    <input type="number" min={0} className={inputCls} value={shared.roomCount} onChange={(e) => setSharedField("roomCount", e.target.value)} />
                </Field>
                <Field label="衛浴數">
                    <input type="number" min={0} className={inputCls} value={shared.bathroomCount} onChange={(e) => setSharedField("bathroomCount", e.target.value)} />
                </Field>
            </div>

            <div className="flex flex-wrap items-center gap-6">
                <label className={checkboxLabelCls}>
                    <input type="checkbox" checked={shared.isPetAllowed} onChange={(e) => setSharedField("isPetAllowed", e.target.checked)} />
                    可養寵物
                </label>
                <label className={checkboxLabelCls}>
                    <input type="checkbox" checked={shared.isParkingIncluded} onChange={(e) => setSharedField("isParkingIncluded", e.target.checked)} />
                    含車位
                </label>
            </div>

            {props.mode === "rent" ? (
                <>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Field label="月租金">
                            <input type="number" min={1} className={inputCls} value={rentForm.monthlyRent} onChange={(e) => setRentField("monthlyRent", e.target.value)} />
                        </Field>
                        <Field label="押金月數">
                            <input type="number" min={0} className={inputCls} value={rentForm.depositMonths} onChange={(e) => setRentField("depositMonths", e.target.value)} />
                        </Field>
                        <Field label="每月管理費">
                            <input type="number" min={0} className={inputCls} value={rentForm.managementFeeMonthly} onChange={(e) => setRentField("managementFeeMonthly", e.target.value)} />
                        </Field>
                        <Field label="最短租期（月）">
                            <input type="number" min={1} className={inputCls} value={rentForm.minimumLeaseMonths} onChange={(e) => setRentField("minimumLeaseMonths", e.target.value)} />
                        </Field>
                    </div>
                    <div className="flex flex-wrap items-center gap-6">
                        <label className={checkboxLabelCls}>
                            <input type="checkbox" checked={rentForm.canRegisterHousehold} onChange={(e) => setRentField("canRegisterHousehold", e.target.checked)} />
                            可入籍
                        </label>
                        <label className={checkboxLabelCls}>
                            <input type="checkbox" checked={rentForm.canCook} onChange={(e) => setRentField("canCook", e.target.checked)} />
                            可開伙
                        </label>
                    </div>
                    <Field label="出租備註">
                        <textarea className={inputCls} rows={4} value={rentForm.rentNotes} onChange={(e) => setRentField("rentNotes", e.target.value)} />
                    </Field>
                </>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Field label="出售總價">
                            <input type="number" min={1} className={inputCls} value={saleForm.saleTotalPrice} onChange={(e) => setSaleField("saleTotalPrice", e.target.value)} />
                        </Field>
                        <Field label="每坪單價">
                            <input type="number" min={0} className={inputCls} value={saleForm.saleUnitPricePerPing} onChange={(e) => setSaleField("saleUnitPricePerPing", e.target.value)} />
                        </Field>
                        <Field label="主建物坪數">
                            <input type="number" min={0} className={inputCls} value={saleForm.mainBuildingPing} onChange={(e) => setSaleField("mainBuildingPing", e.target.value)} />
                        </Field>
                        <Field label="附屬建物坪數">
                            <input type="number" min={0} className={inputCls} value={saleForm.auxiliaryBuildingPing} onChange={(e) => setSaleField("auxiliaryBuildingPing", e.target.value)} />
                        </Field>
                        <Field label="陽台坪數">
                            <input type="number" min={0} className={inputCls} value={saleForm.balconyPing} onChange={(e) => setSaleField("balconyPing", e.target.value)} />
                        </Field>
                        <Field label="土地坪數">
                            <input type="number" min={0} className={inputCls} value={saleForm.landPing} onChange={(e) => setSaleField("landPing", e.target.value)} />
                        </Field>
                        <Field label="車位類型">
                            <input className={inputCls} value={saleForm.parkingSpaceType} onChange={(e) => setSaleField("parkingSpaceType", e.target.value)} />
                        </Field>
                        <Field label="車位價格">
                            <input type="number" min={0} className={inputCls} value={saleForm.parkingSpacePrice} onChange={(e) => setSaleField("parkingSpacePrice", e.target.value)} />
                        </Field>
                    </div>
                    <Field label="出售備註">
                        <textarea className={inputCls} rows={4} value={saleForm.saleNotes} onChange={(e) => setSaleField("saleNotes", e.target.value)} />
                    </Field>
                </>
            )}

            <Field label="刊登描述">
                <textarea className={inputCls} rows={5} value={shared.description} onChange={(e) => setSharedField("description", e.target.value)} />
            </Field>

            {error ? <p className="text-sm text-error">{error}</p> : null}

            <div className="flex justify-end gap-3">
                <button
                    type="button"
                    onClick={props.onCancel}
                    className="rounded-lg border border-outline-variant/50 bg-transparent px-5 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
                >
                    取消
                </button>
                <button
                    type="button"
                    disabled={props.submitting || !canSubmit}
                    onClick={() => void handleSubmit()}
                    className="rounded-lg bg-primary-container px-5 py-2.5 text-sm font-bold text-on-surface transition-colors hover:bg-inverse-primary disabled:opacity-50"
                >
                    {props.submitting ? "儲存中..." : props.mode === "rent" ? "儲存出租資料" : "儲存出售資料"}
                </button>
            </div>
        </div>
    );
}

import { useEffect, useState } from "react";
import { getAuthMe } from "../api/authApi";
import { getKYCStatus, type KYCStatus } from "../api/kycApi";

export interface IdentityState {
    loading: boolean;
    authenticated: boolean;
    kycStatus: KYCStatus | null;
    activatedRoles: string[];
    hasRole: (role: string) => boolean;
    hasAnyRole: (roles: string[]) => boolean;
}

export function useIdentity(): IdentityState {
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);
    const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
    const [activatedRoles, setActivatedRoles] = useState<string[]>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const auth = await getAuthMe().catch(() => ({ authenticated: false, isPlatformWallet: false }));
                if (!auth.authenticated) {
                    setAuthenticated(false);
                    setLoading(false);
                    return;
                }
                setAuthenticated(true);
                const kyc = await getKYCStatus().catch(() => ({ kycStatus: "UNVERIFIED" as KYCStatus, credentials: [] }));
                setKycStatus(kyc.kycStatus);
                setActivatedRoles(kyc.credentials ?? []);
            } catch {
                setAuthenticated(false);
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

    const hasRole = (role: string) => activatedRoles.includes(role);
    const hasAnyRole = (roles: string[]) => roles.some((r) => activatedRoles.includes(r));

    return { loading, authenticated, kycStatus, activatedRoles, hasRole, hasAnyRole };
}

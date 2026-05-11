// react-service/src/components/common/RequireAuth.tsx
import { type ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getAuthMe } from "@/api/authApi";

type Props = { children: ReactNode };

export default function RequireAuth({ children }: Props) {
    const [status, setStatus] = useState<"loading" | "auth" | "unauth">("loading");

    useEffect(() => {
        let cancelled = false;
        getAuthMe()
            .then((r) => { if (!cancelled) setStatus(r.authenticated ? "auth" : "unauth"); })
            .catch(() => { if (!cancelled) setStatus("unauth"); });
        return () => { cancelled = true; };
    }, []);

    if (status === "loading") return null;
    if (status === "unauth") return <Navigate to="/login" replace />;
    return <>{children}</>;
}

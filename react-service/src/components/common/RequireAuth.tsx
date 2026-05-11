// react-service/src/components/common/RequireAuth.tsx
import { type ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getAuthMe } from "@/api/authApi";

export default function RequireAuth({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<"loading" | "auth" | "unauth">("loading");

    useEffect(() => {
        getAuthMe()
            .then((r) => setStatus(r.authenticated ? "auth" : "unauth"))
            .catch(() => setStatus("unauth"));
    }, []);

    if (status === "loading") return null;
    if (status === "unauth") return <Navigate to="/login" replace />;
    return <>{children}</>;
}

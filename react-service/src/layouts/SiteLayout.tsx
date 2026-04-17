import type { ReactNode } from "react";
import Header from "../components/common/Header";

interface SiteLayoutProps {
    children: ReactNode;
}

const SiteLayout = ({ children }: SiteLayoutProps) => {
    return (
        <div className="app-layout">
            <Header />
            <main>{children}</main>
            <footer className="app-footer">
                <div className="app-footer-inner">
                    <div className="app-footer-brand">
                        <span className="app-footer-title">去中心化房屋平台</span>
                        <p className="app-footer-copy">© 2026 去中心化房屋平台</p>
                    </div>
                    <div className="app-footer-links">
                        <a href="#">平台說明</a>
                        <a href="#">隱私政策</a>
                        <a href="#">鏈上登記</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default SiteLayout;

import type { ReactNode } from "react";
import Header from "../components/common/Header";


interface AppLayoutProps {
    children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
    return (
        <div className="app-layout">
            <Header />
            <main>{children}</main>
            <footer className="app-footer">
                <div className="app-footer-inner">
                    <div className="app-footer-brand">
                        <span className="app-footer-title">去中心化房屋平台</span>
                        <p className="app-footer-copy">© 2024 On-chain Task Tracker.</p>
                    </div>
                    <div className="app-footer-links">
                        <a href="#">Documentation</a>
                        <a href="#">Privacy Policy</a>
                        <a href="#">On-chain Registry</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default AppLayout;

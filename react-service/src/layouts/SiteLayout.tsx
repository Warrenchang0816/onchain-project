import type { ReactNode } from "react";
import Header from "../components/common/Header";

interface SiteLayoutProps {
    children: ReactNode;
}

const SiteLayout = ({ children }: SiteLayoutProps) => (
    <div className="flex min-h-screen flex-col bg-background font-body text-on-surface antialiased">
        <Header />
        <main className="flex flex-grow flex-col">{children}</main>
        <footer className="mt-auto w-full bg-[#F5F3EE] py-12">
            <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-6 px-6 text-center md:flex-row md:px-12 md:text-left">
                <div className="text-sm font-bold text-[#1C1917]">
                    © 2024 去中心化房屋平台。鏈上媒合服務持續建置中。
                </div>
                <nav className="flex flex-wrap justify-center gap-5 md:justify-end">
                    {["使用條款", "隱私政策", "安全說明", "聯絡我們"].map((label) => (
                        <a
                            key={label}
                            href="#"
                            className="text-sm font-normal text-[#78716C] underline decoration-[#059669] transition-colors hover:text-[#1C1917]"
                        >
                            {label}
                        </a>
                    ))}
                </nav>
            </div>
        </footer>
    </div>
);

export default SiteLayout;

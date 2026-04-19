import type { ReactNode } from "react";
import Header from "../components/common/Header";

interface SiteLayoutProps { children: ReactNode }

const SiteLayout = ({ children }: SiteLayoutProps) => (
    <div className="bg-background text-on-surface font-body min-h-screen flex flex-col antialiased">
        <Header />
        <main className="flex-grow flex flex-col">{children}</main>
        <footer className="bg-[#F5F3EE] dark:bg-stone-900 w-full py-16 mt-auto">
            <div className="flex flex-col md:flex-row justify-between items-center px-12 max-w-[1440px] mx-auto gap-8 text-center md:text-left">
                <div className="text-base font-bold text-[#1C1917] dark:text-stone-200">
                    © 2024 去中心化房屋平台. Luminous Pavilion Architecture.
                </div>
                <nav className="flex flex-wrap justify-center md:justify-end gap-6">
                    {["隱私政策", "服務條款", "關於我們", "媒體資源"].map((label) => (
                        <a
                            key={label}
                            href="#"
                            className="text-sm font-normal text-[#78716C] dark:text-stone-400 leading-[1.75] hover:text-[#1C1917] dark:hover:text-stone-100 underline decoration-[#059669] transition-all ease-in-out duration-200"
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

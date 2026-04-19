import type { ReactNode } from "react";
import Header from "../components/common/Header";

interface AppLayoutProps {
    children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
    return (
        <div className="min-h-screen flex flex-col bg-[#fbf9f4]">
            <Header />
            <main className="flex-1">
                {children}
            </main>
            <footer className="bg-[#f0eee9] border-t border-[#e4e2dd] mt-16">
                <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                        <div className="text-base font-extrabold text-[#1b1c19] border-b-2 border-[#E8B800] inline-block pb-0.5 mb-2">
                            去中心化房屋平台
                        </div>
                        <p className="text-xs text-[#807660]">© 2024 去中心化房屋平台。保留所有權利。</p>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-[#4e4633]">
                        <a href="#" className="hover:text-[#006c4a] transition-colors border-b border-transparent hover:border-[#006c4a]">文件</a>
                        <a href="#" className="hover:text-[#006c4a] transition-colors border-b border-transparent hover:border-[#006c4a]">隱私政策</a>
                        <a href="#" className="hover:text-[#006c4a] transition-colors border-b border-transparent hover:border-[#006c4a]">鏈上登記</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default AppLayout;

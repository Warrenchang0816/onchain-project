import { useEffect, useState } from "react";
import { fetchSIWEMessage, verifySIWE, getAuthMe, logout   } from "@/api/authApi";
import { toChecksumAddress, signSIWEMessage } from "@/api/walletApi";
import ConfirmDialog from "@/components/common/ConfirmDialog";

declare global {
    interface Window {
        ethereum?: {
            isMetaMask?: boolean;
            request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            on?: (event: string, listener: (...args: unknown[]) => void) => void;
            removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
        };
    }
}

function shortAddress(address?: string | null): string {
    if (!address) {
        return "";
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const SEPOLIA_CHAIN_ID = "0xaa36a7";

function getChainLabel(chainId?: string | null): string {
    if (!chainId) {
        return "Unknown";
    }

    switch (chainId.toLowerCase()) {
        case "0x1":
            return "Ethereum Mainnet";
        case "0xaa36a7":
            return "Sepolia";
        case "0x89":
            return "Polygon";
        case "0xa":
            return "Optimism";
        case "0xa4b1":
            return "Arbitrum One";
        case "0x2105":
            return "Base";
        default:
            return chainId;
    }
}

function isWrongNetwork(chainId?: string | null): boolean {
    return !!chainId && chainId.toLowerCase() !== SEPOLIA_CHAIN_ID;
}

function getProvider() {
    return window.ethereum;
}

const WalletConnectPanel = () => {
    const [address, setAddress] = useState<string | null>(null);
    const [chainId, setChainId] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

    useEffect(() => {
        const provider = getProvider();

        if (!provider) {
            setIsReady(true);
            setErrorMessage("MetaMask 未安裝");
            return;
        }

        const syncState = async () => {
            try {
                const accounts = await provider.request({
                    method: "eth_accounts",
                }) as string[];

                const currentChainId = await provider.request({
                    method: "eth_chainId",
                }) as string;

                const currentAddress = accounts[0] ?? null;

                setAddress(currentAddress);
                setChainId(currentChainId ?? null);

                try {
                    const res = await getAuthMe();
                    setIsAuthenticated(Boolean(res.authenticated && currentAddress));
                } catch {
                    setIsAuthenticated(false);
                }
            } catch (error) {
                console.error("syncState failed:", error);
                setAddress(null);
                setChainId(null);
                setIsAuthenticated(false);
            } finally {
                setIsReady(true);
            }
        };

        const handleAccountsChanged = async (accounts: unknown) => {
            const nextAccounts = Array.isArray(accounts) ? (accounts as string[]) : [];
            const nextAddress = nextAccounts[0] ?? null;

            let previousAddress: string | null = null;
            setAddress((prev) => {
                previousAddress = prev;
                return nextAddress;
            });

            if (!nextAddress) {
                try {
                    await logout();
                } catch {
                    // non-blocking: logout failure should not prevent disconnect
                }
                setIsAuthenticated(false);
                return;
            }

            // 地址變了就強制登出，要求重新簽名
            if (
                previousAddress &&
                nextAddress.toLowerCase() !== (previousAddress as string).toLowerCase()
            ) {
                try {
                    await logout();
                } catch {
                    // non-blocking: logout failure should not prevent address switch
                }
                setIsAuthenticated(false);
                return;
            }

            try {
                const res = await getAuthMe();
                setIsAuthenticated(Boolean(res.authenticated && nextAddress));
            } catch {
                setIsAuthenticated(false);
            }
        };

        const handleChainChanged = (nextChainId: unknown) => {
            if (typeof nextChainId === "string") {
                setChainId(nextChainId);
                return;
            }

            setChainId(null);
        };

        syncState();

        provider.on?.("accountsChanged", handleAccountsChanged);
        provider.on?.("chainChanged", handleChainChanged);

        return () => {
            provider.removeListener?.("accountsChanged", handleAccountsChanged);
            provider.removeListener?.("chainChanged", handleChainChanged);
        };
    }, []);

    const handleSwitchToSepolia = async () => {
        const provider = getProvider();
        if (!provider) return;

        try {
            setErrorMessage("");
            await provider.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: SEPOLIA_CHAIN_ID }],
            });
        } catch (error) {
            const err = error as { code?: number; message?: string } | null;
            // 4902: 錢包沒有這條鏈，需要先新增
            if (err?.code === 4902) {
                try {
                    await provider.request({
                        method: "wallet_addEthereumChain",
                        params: [{
                            chainId: SEPOLIA_CHAIN_ID,
                            chainName: "Sepolia",
                            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                            rpcUrls: ["https://rpc.sepolia.org"],
                            blockExplorerUrls: ["https://sepolia.etherscan.io"],
                        }],
                    });
                } catch {
                    setErrorMessage("無法新增 Sepolia 網路");
                }
            } else {
                setErrorMessage(err?.message ?? "切換網路失敗");
            }
        }
    };

    const handleConnect = async () => {
        const provider = getProvider();

        if (!provider) {
            setErrorMessage("MetaMask 未安裝");
            return;
        }

        try {
            setIsConnecting(true);
            setErrorMessage("");

            const accounts = await provider.request({
                method: "eth_requestAccounts",
            }) as string[];

            const currentChainId = await provider.request({
                method: "eth_chainId",
            }) as string;

            setAddress(accounts[0] ?? null);
            setChainId(currentChainId ?? null);

            // 連接後若不是 Sepolia，自動要求切換
            if (currentChainId && currentChainId.toLowerCase() !== SEPOLIA_CHAIN_ID) {
                await provider.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: SEPOLIA_CHAIN_ID }],
                });
            }
        } catch (error) {
            console.error("connect failed:", error);

            setAddress(null);
            setChainId(null);
            setIsAuthenticated(false);

            const err = error as { code?: number; message?: string } | null;
            if (err?.code === 4001) {
                setErrorMessage("你取消了連線請求");
            } else if (err?.code === -32002) {
                setErrorMessage("MetaMask 連線請求進行中，請查看錢包視窗");
            } else {
                setErrorMessage(err?.message ?? "MetaMask 連線失敗");
            }
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        try {
            setIsDisconnecting(true);
            setErrorMessage("");

            // 先清後端 session
            try {
                await logout();
            } catch {
                // 後端 logout 失敗不阻止前端斷開
            }

            setIsAuthenticated(false);

            const provider = getProvider();

            if (provider) {
                try {
                    await provider.request({
                        method: "wallet_revokePermissions",
                        params: [{ eth_accounts: {} }],
                    });
                } catch {
                    // 某些 MetaMask / 環境不支援 revokePermissions，忽略
                }

                const accounts = (await provider.request({
                    method: "eth_accounts",
                })) as string[];

                const currentChainId = (await provider.request({
                    method: "eth_chainId",
                })) as string;

                setAddress(accounts[0] ?? null);
                setChainId(currentChainId ?? null);
            } else {
                setAddress(null);
                setChainId(null);
            }

            // 如果 revokePermissions 沒真的清掉，就前端至少先鎖成未連線
            setAddress(null);
            setIsAuthenticated(false);

            // 直接刷新，避免 TaskPage 還留舊狀態
            window.location.reload();
        } catch (error) {
            console.error("disconnect failed:", error);
            const err = error as { message?: string } | null;
            setErrorMessage(err?.message ?? "中斷連線失敗");
        } finally {
            setIsDisconnecting(false);
        }
    };

    const handleSignIn = async () => {
        if (!address) {
            setErrorMessage("請先連接 MetaMask");
            return;
        }

        try {
            setIsSigningIn(true);
            setErrorMessage("");

            const checksumAddress = toChecksumAddress(address);

            const { message } = await fetchSIWEMessage({
                address: checksumAddress,
            });

            const signature = await signSIWEMessage(message, checksumAddress);
            
            const verifyResult = await verifySIWE({
                message,
                signature,
                address: checksumAddress,
            });

            console.log("verify result:", verifyResult);

            setIsAuthenticated(verifyResult.authenticated);

            // 🔥 登入成功直接刷新
            if (verifyResult.authenticated) {
                window.location.reload();
            }
        } catch (error) {
            console.error("sign in failed:", error);

            const err = error as { code?: number; message?: string } | null;
            if (err?.code === 4001) {
                setErrorMessage("你取消了簽名");
            } else {
                setErrorMessage(err?.message ?? "登入失敗");
            }

            setIsAuthenticated(false);
        } finally {
            setIsSigningIn(false);
        }
    };

    const handleConfirmLogout = async () => {
        try {
            setIsDisconnecting(true);
            setErrorMessage("");

            // 🔥 呼叫後端 logout
            await logout();

            // 🔥 清前端狀態
            setIsAuthenticated(false);

            // 🔥 關閉彈窗
            setIsLogoutConfirmOpen(false);

            // 🔥 刷新頁面（關鍵）
            window.location.reload();

        } catch (error) {
            console.error("logout failed:", error);
            const err = error as { message?: string } | null;
            setErrorMessage(err?.message ?? "登出失敗");
        } finally {
            setIsDisconnecting(false);
        }
    };

    if (!isReady) {
        return <div>Loading wallet...</div>;
    }

    if (!window.ethereum) {
        return (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>MetaMask 未安裝</span>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {!address && (
                <button
                    type="button"
                    onClick={handleConnect}
                    disabled={isConnecting}
                >
                    {isConnecting ? "Connecting..." : "Connect MetaMask"}
                </button>
            )}

            {address && (
                <>
                    <span>{shortAddress(address)}</span>
                    <span>{getChainLabel(chainId)}</span>
                    <span>
                        {isAuthenticated ? "Authenticated" : "Wallet Connected"}
                    </span>

                    {!isAuthenticated && !isWrongNetwork(chainId) && (
                        <button
                            type="button"
                            onClick={handleSignIn}
                            disabled={isSigningIn}
                        >
                            {isSigningIn ? "Signing..." : "Sign to Login"}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleDisconnect}
                        disabled={isDisconnecting}
                    >
                        {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                    </button>

                    {isAuthenticated && (
                        <button
                            type="button"
                            onClick={() => setIsLogoutConfirmOpen(true)}
                            disabled={isDisconnecting}
                        >
                            Logout
                        </button>
                    )}
                </>
            )}

            {errorMessage && (
                <span style={{ color: "red" }}>{errorMessage}</span>
            )}
            
            <ConfirmDialog
                isOpen={isLogoutConfirmOpen}
                title="Logout"
                description="Are you sure you want to logout?"
                confirmText="Logout"
                cancelText="Cancel"
                onConfirm={handleConfirmLogout}
                onCancel={() => setIsLogoutConfirmOpen(false)}
            />
        </div>
        
    );
};


export default WalletConnectPanel;
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { sepolia } from "wagmi/chains";

const rpcUrl =
    import.meta.env.VITE_RPC_URL && import.meta.env.VITE_RPC_URL !== "https://your-sepolia-rpc"
        ? import.meta.env.VITE_RPC_URL
        : undefined;

export const wagmiConfig = createConfig({
    chains: [sepolia],
    connectors: [
        injected({
            target: "metaMask",
        }),
    ],
    transports: {
        [sepolia.id]: http(rpcUrl),
    },
});
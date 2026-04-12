export const REWARD_VAULT_ADDRESS =
    import.meta.env.VITE_REWARD_VAULT_ADDRESS || "";

export const ERC20_REWARD_VAULT_ADDRESS =
    import.meta.env.VITE_ERC20_REWARD_VAULT_ADDRESS || "";

export const EXPLORER_URL =
    import.meta.env.VITE_EXPLORER_URL || "https://sepolia.etherscan.io";

export const TARGET_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || "11155111");
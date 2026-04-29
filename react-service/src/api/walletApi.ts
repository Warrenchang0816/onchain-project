import { getAddress } from "viem";

/**
 * Returns the EIP-55 checksum form of an Ethereum address.
 * Delegates to viem's getAddress which throws on invalid input.
 */
export function toChecksumAddress(address: string): string {
    return getAddress(address);
}

/**
 * Signs a SIWE message with MetaMask via personal_sign.
 * Returns the hex signature string.
 */
export async function signSIWEMessage(message: string, address: string): Promise<string> {
    const provider = window.ethereum;
    if (!provider) {
        throw new Error("請先安裝 MetaMask。");
    }

    const signature = await provider.request({
        method: "personal_sign",
        params: [message, address],
    });

    return signature as string;
}

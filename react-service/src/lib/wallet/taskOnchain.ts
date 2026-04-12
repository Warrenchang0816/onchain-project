import { keccak256, parseEther, stringToBytes } from "viem";
import { writeContract } from '@wagmi/core'
import { wagmiConfig } from './config'
import { taskRewardVaultAbi } from './abi/taskRewardVaultAbi'

export async function fundTaskOnchain(taskId: string, amount: string) {
    return await writeContract(wagmiConfig, {
        address: import.meta.env.VITE_REWARD_VAULT_ADDRESS,
        abi: taskRewardVaultAbi,
        functionName: "createAndFundTask",
        args: [toTaskBytes32(taskId), toTaskBytes32(wagmiConfig.chains[0].nativeCurrency.symbol)],
        value: toRewardValue(amount),
    })
}

export function toTaskBytes32(taskId: string): `0x${string}` {
    return keccak256(stringToBytes(taskId));
}

export function toRewardValue(rewardAmount: string): bigint {
    const normalized = rewardAmount?.trim() || "0";
    return parseEther(normalized);
}
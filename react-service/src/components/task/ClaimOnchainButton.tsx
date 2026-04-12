import { useEffect, useRef, useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { isAddress } from "viem";
import AppButton from "../common/AppButton";
import { REWARD_VAULT_ADDRESS } from "../../lib/wallet/constants";
import { taskRewardVaultAbi } from "../../lib/wallet/abi/taskRewardVaultAbi";
import { toTaskBytes32 } from "../../lib/wallet/taskOnchain";
import type { Task } from "../../types/task";

interface ClaimOnchainButtonProps {
    task: Task;
    onSuccess?: () => Promise<void> | void;
}

const ClaimOnchainButton = ({ task, onSuccess }: ClaimOnchainButtonProps) => {
    const { writeContractAsync, isPending } = useWriteContract();
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const syncedRef = useRef(false);

    const { isSuccess: isReceiptSuccess, isLoading: isWaitingReceipt } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    const isProcessing = isPending || isWaitingReceipt;

    useEffect(() => {
        const syncClaimed = async () => {
            if (!txHash || !isReceiptSuccess || syncedRef.current) {
                return;
            }

            syncedRef.current = true;

            try {
                const res = await fetch(
                    `${import.meta.env.VITE_API_GO_SERVICE_URL}/tasks/${task.id}/onchain/claimed`,
                    {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ txHash }),
                    },
                );

                if (!res.ok) {
                    const body = await res.text();
                    setErrorMessage(`鏈上交易已成功（${txHash}），但 DB 同步失敗（${res.status}）：${body}。請截圖並聯繫管理員。`);
                    return;
                }

                await onSuccess?.();
            } catch (err) {
                setErrorMessage(`鏈上交易已成功（${txHash}），但 DB 同步請求失敗：${err instanceof Error ? err.message : String(err)}。請截圖並聯繫管理員。`);
            }
        };

        void syncClaimed();
    }, [txHash, isReceiptSuccess, task.id, onSuccess]);

    const handleClaim = async () => {
        try {
            setErrorMessage("");
            syncedRef.current = false;

            const hash = await writeContractAsync({
                address: REWARD_VAULT_ADDRESS as `0x${string}`,
                abi: taskRewardVaultAbi,
                functionName: "claimReward",
                args: [toTaskBytes32(task.taskId)],
            });

            setTxHash(hash);
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Transaction failed.",
            );
        }
    };

    if (!task.canClaimOnchain || !isAddress(REWARD_VAULT_ADDRESS)) {
        return null;
    }

    return (
        <div className="onchain-button-wrapper">
            {errorMessage && <p className="form-error">{errorMessage}</p>}
            <AppButton type="button" onClick={handleClaim} disabled={isProcessing}>
                {isProcessing ? "..." : "Claim On-chain"}
            </AppButton>
        </div>
    );
};

export default ClaimOnchainButton;

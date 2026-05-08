import hre from "hardhat";

async function main() {
    const { viem } = await hre.network.connect();

    if (!viem) {
        throw new Error("Hardhat viem plugin is not loaded.");
    }

    const [deployer] = await viem.getWalletClients();

    const treasuryAddress = process.env.TREASURY_ADDRESS;
    if (!treasuryAddress) {
        throw new Error("TREASURY_ADDRESS is required");
    }

    const contract = await viem.deployContract("TaskRewardVault", [
        deployer.account.address,
        deployer.account.address,
        treasuryAddress,
        500,
    ]);

    console.log("TaskRewardVault deployed:", contract.address);
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
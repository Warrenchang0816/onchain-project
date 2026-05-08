import hre from "hardhat";

/**
 * 部署可信房屋媒合平台合約組
 *
 * 部署順序：
 *   1. IdentityNFT    (SBT，TWID 整合，取代自建 KYC)
 *   2. PropertyRegistry
 *   3. AgencyRegistry
 *   4. ListingStakeVault
 *   5. CaseTracker
 *
 * 環境變數：
 *   TREASURY_ADDRESS   — 財務錢包地址（必填）
 *   OPERATOR_ADDRESS   — 後端 Operator 錢包地址（選填，預設 deployer）
 *   USDC_ADDRESS       — Sepolia USDC 地址（選填，不填則不加入白名單）
 *   USDT_ADDRESS       — Sepolia USDT 地址（選填，不填則不加入白名單）
 *
 * Sepolia 測試網穩定幣地址（參考）：
 *   USDC: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238（Circle 官方 Sepolia USDC）
 *   USDT: 測試網無官方版本，可用 mock 或跳過
 *
 * 執行：
 *   npx hardhat run scripts/deployHousePlatform.ts --network sepolia
 *   或
 *   npm run deploy:house-platform:sepolia
 */
async function main() {
    const { viem } = await hre.network.connect();

    if (!viem) {
        throw new Error("Hardhat viem plugin is not loaded.");
    }

    const [deployer] = await viem.getWalletClients();
    const deployerAddress = deployer.account.address;

    const treasuryAddress = process.env.TREASURY_ADDRESS;
    if (!treasuryAddress) {
        throw new Error("TREASURY_ADDRESS env variable is required");
    }

    const operatorAddress = (process.env.OPERATOR_ADDRESS ?? deployerAddress) as `0x${string}`;

    // 平台支援的穩定幣（建構時固定）
    const usdcAddress = (process.env.USDC_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
    const usdtAddress = (process.env.USDT_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;

    console.log("=== House Platform Deployment ===");
    console.log("Deployer  :", deployerAddress);
    console.log("Operator  :", operatorAddress);
    console.log("Treasury  :", treasuryAddress);
    console.log("USDC      :", usdcAddress === "0x0000000000000000000000000000000000000000" ? "（未設定，不支援）" : usdcAddress);
    console.log("USDT      :", usdtAddress === "0x0000000000000000000000000000000000000000" ? "（未設定，不支援）" : usdtAddress);
    console.log("");

    // 1. IdentityNFT（SBT，TWID 整合）
    const identityNFT = await viem.deployContract("IdentityNFT", [
        deployerAddress,    // admin
        operatorAddress,    // operator
    ]);
    console.log("1. IdentityNFT         :", identityNFT.address);

    // 2. PropertyRegistry（依賴 IdentityNFT）
    const propertyRegistry = await viem.deployContract("PropertyRegistry", [
        deployerAddress,
        operatorAddress,
        identityNFT.address,            // 屋主登記時驗證 KYC
    ]);
    console.log("2. PropertyRegistry    :", propertyRegistry.address);

    // 3. AgencyRegistry（依賴 PropertyRegistry，授權時驗證持有人身份）
    const agencyRegistry = await viem.deployContract("AgencyRegistry", [
        deployerAddress,
        operatorAddress,
        propertyRegistry.address,       // 屋主授權時驗證 isOwner
    ]);
    console.log("3. AgencyRegistry      :", agencyRegistry.address);

    // 4. ListingStakeVault（支援 ETH + USDC + USDT，部署時固定）
    const listingStakeVault = await viem.deployContract("ListingStakeVault", [
        deployerAddress,
        operatorAddress,
        treasuryAddress as `0x${string}`,
        usdcAddress,    // USDC 合約地址（address(0) = 不支援）
        usdtAddress,    // USDT 合約地址（address(0) = 不支援）
    ]);
    console.log("4. ListingStakeVault   :", listingStakeVault.address);

    // 5. CaseTracker
    const caseTracker = await viem.deployContract("CaseTracker", [
        deployerAddress,
        operatorAddress,
    ]);
    console.log("5. CaseTracker         :", caseTracker.address);

    console.log("\n=== 部署完成，請更新 go-service/.env ===");
    console.log(`IDENTITY_NFT_ADDRESS=${identityNFT.address}`);
    console.log(`PROPERTY_REGISTRY_ADDRESS=${propertyRegistry.address}`);
    console.log(`AGENCY_REGISTRY_ADDRESS=${agencyRegistry.address}`);
    console.log(`LISTING_STAKE_VAULT_ADDRESS=${listingStakeVault.address}`);
    console.log(`CASE_TRACKER_ADDRESS=${caseTracker.address}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

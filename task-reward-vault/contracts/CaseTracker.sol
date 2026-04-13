// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CaseTracker
 * @notice 可信房屋媒合平台 — 案件生命週期鏈上追蹤
 *
 * 設計原則（On-chain First）：
 *   - 案件的每一次狀態轉換均記錄在鏈上，作為不可竄改的流程憑據
 *   - 支援兩種案件類型的獨立狀態機：
 *
 *     租屋（RENT）：OPEN → MATCHED → SIGN → CLOSED
 *     買賣（SALE）：OPEN → MATCHED → SIGN → BANKING → CLOSED
 *     任何狀態 → CANCELLED（非 CLOSED）
 *     任何狀態 → DISPUTED（需後台介入，非 CLOSED）
 *
 *   - introducedByAgent：仲介引入足跡
 *     若此案件由仲介推播促成，記錄仲介錢包地址。
 *     作用：防「過河拆橋」— 屋主在 MATCHED 後解約並私下成交，
 *     仲介可憑鏈上紀錄申訴，由 OPERATOR 核查後觸發 slash 懲罰。
 *
 *   - OPERATOR 推進案件狀態，前端顯示對應進度
 *   - 每次轉換 emit event，作為鏈上 event log（對應 DB case_events）
 *
 * 角色：
 *   DEFAULT_ADMIN_ROLE — OZ 角色管理機制（不用於業務操作）
 *   OPERATOR_ROLE      — 平台後端，建立與推進案件
 */
contract CaseTracker is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum CaseType { RENT, SALE }

    // 使用統一 Status enum，透過 CaseType 限制合法轉換
    enum CaseStatus {
        OPEN,       // 上架，媒合進行中
        MATCHED,    // 媒合達成：租屋=收訂金，買賣=收斡旋
        SIGN,       // 簽約流程中
        BANKING,    // 銀行流程中（買賣專用）
        CLOSED,     // 案件成功結束
        CANCELLED,  // 取消（非 CLOSED 狀態皆可）
        DISPUTED    // 糾紛（後台介入）
    }

    struct CaseInfo {
        bytes32    caseId;
        bytes32    listingId;
        bytes32    propertyId;
        address    owner;
        address    counterparty;        // 租客 / 買方
        address    introducedByAgent;   // 引入仲介（address(0) = 屋主自租）
        CaseType   caseType;
        CaseStatus status;
        uint256    openedAt;
        uint256    updatedAt;
        bool       exists;
    }

    mapping(bytes32 => CaseInfo) public cases;

    // --------------------------------------------------------
    // Events
    // --------------------------------------------------------
    event CaseOpened(
        bytes32 indexed caseId,
        bytes32 indexed listingId,
        bytes32 indexed propertyId,
        address         owner,
        address         counterparty,
        address         introducedByAgent,
        CaseType        caseType,
        uint256         openedAt
    );
    event CaseTransitioned(
        bytes32 indexed caseId,
        CaseStatus      oldStatus,
        CaseStatus      newStatus,
        uint256         timestamp
    );
    event CaseClosed(bytes32 indexed caseId, uint256 closedAt);
    event CaseCancelled(bytes32 indexed caseId, string reason, uint256 cancelledAt);
    event CaseDisputed(bytes32 indexed caseId, string reason, uint256 disputedAt);
    event CaseDisputeResolved(bytes32 indexed caseId, CaseStatus resolvedTo, uint256 resolvedAt);

    // --------------------------------------------------------
    // Constructor
    // --------------------------------------------------------
    constructor(address admin, address operator) {
        require(admin    != address(0), "invalid admin");
        require(operator != address(0), "invalid operator");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, operator);
    }

    // --------------------------------------------------------
    // OPERATOR 操作
    // --------------------------------------------------------

    /**
     * @notice 建立案件（媒合達成後由 OPERATOR 呼叫）
     * @param introducedByAgent 引入仲介錢包（屋主自租時傳 address(0)）
     */
    function openCase(
        bytes32  caseId,
        bytes32  listingId,
        bytes32  propertyId,
        address  owner,
        address  counterparty,
        address  introducedByAgent,
        CaseType caseType
    ) external onlyRole(OPERATOR_ROLE) {
        require(caseId       != bytes32(0), "invalid caseId");
        require(listingId    != bytes32(0), "invalid listingId");
        require(propertyId   != bytes32(0), "invalid propertyId");
        require(owner        != address(0), "invalid owner");
        require(counterparty != address(0), "invalid counterparty");
        require(!cases[caseId].exists,      "case already exists");

        cases[caseId] = CaseInfo({
            caseId:             caseId,
            listingId:          listingId,
            propertyId:         propertyId,
            owner:              owner,
            counterparty:       counterparty,
            introducedByAgent:  introducedByAgent,
            caseType:           caseType,
            status:             CaseStatus.OPEN,
            openedAt:           block.timestamp,
            updatedAt:          block.timestamp,
            exists:             true
        });

        emit CaseOpened(
            caseId,
            listingId,
            propertyId,
            owner,
            counterparty,
            introducedByAgent,
            caseType,
            block.timestamp
        );
    }

    /**
     * @notice 推進案件到下一個狀態
     * 狀態機限制（依 caseType）：
     *   RENT: OPEN → MATCHED → SIGN → CLOSED
     *   SALE: OPEN → MATCHED → SIGN → BANKING → CLOSED
     *   Any  → CANCELLED（需另呼叫 cancelCase）
     *   Any  → DISPUTED（需另呼叫 disputeCase）
     */
    function advanceCase(
        bytes32    caseId,
        CaseStatus newStatus
    ) external onlyRole(OPERATOR_ROLE) {
        CaseInfo storage c = cases[caseId];
        require(c.exists,                                          "case not found");
        require(newStatus != CaseStatus.CANCELLED,                 "use cancelCase() to cancel");
        require(newStatus != CaseStatus.DISPUTED,                  "use disputeCase() to dispute");
        require(_isValidTransition(c.caseType, c.status, newStatus), "invalid state transition");

        CaseStatus oldStatus = c.status;
        c.status    = newStatus;
        c.updatedAt = block.timestamp;

        emit CaseTransitioned(caseId, oldStatus, newStatus, block.timestamp);

        if (newStatus == CaseStatus.CLOSED) {
            emit CaseClosed(caseId, block.timestamp);
        }
    }

    /**
     * @notice 取消案件（任何非終止狀態皆可，需提供原因）
     */
    function cancelCase(
        bytes32         caseId,
        string calldata reason
    ) external onlyRole(OPERATOR_ROLE) {
        CaseInfo storage c = cases[caseId];
        require(c.exists,                          "case not found");
        require(c.status != CaseStatus.CLOSED,     "case already closed");
        require(c.status != CaseStatus.CANCELLED,  "case already cancelled");
        require(c.status != CaseStatus.DISPUTED,   "case in dispute: resolve first");

        CaseStatus oldStatus = c.status;
        c.status    = CaseStatus.CANCELLED;
        c.updatedAt = block.timestamp;

        emit CaseTransitioned(caseId, oldStatus, CaseStatus.CANCELLED, block.timestamp);
        emit CaseCancelled(caseId, reason, block.timestamp);
    }

    /**
     * @notice 標記案件進入糾紛狀態（需後台介入處理）
     * @dev    任何非終止狀態皆可進入 DISPUTED
     *         DISPUTED 後需呼叫 resolveDispute 才能結案或取消
     */
    function disputeCase(
        bytes32         caseId,
        string calldata reason
    ) external onlyRole(OPERATOR_ROLE) {
        CaseInfo storage c = cases[caseId];
        require(c.exists,                          "case not found");
        require(c.status != CaseStatus.CLOSED,     "case already closed");
        require(c.status != CaseStatus.CANCELLED,  "case already cancelled");
        require(c.status != CaseStatus.DISPUTED,   "case already in dispute");

        CaseStatus oldStatus = c.status;
        c.status    = CaseStatus.DISPUTED;
        c.updatedAt = block.timestamp;

        emit CaseTransitioned(caseId, oldStatus, CaseStatus.DISPUTED, block.timestamp);
        emit CaseDisputed(caseId, reason, block.timestamp);
    }

    /**
     * @notice 解決糾紛，將案件導向最終狀態
     * @param resolvedTo 只允許 CLOSED 或 CANCELLED
     */
    function resolveDispute(
        bytes32         caseId,
        CaseStatus      resolvedTo,
        string calldata resolution
    ) external onlyRole(OPERATOR_ROLE) {
        CaseInfo storage c = cases[caseId];
        require(c.exists,                          "case not found");
        require(c.status == CaseStatus.DISPUTED,   "case not in dispute");
        require(
            resolvedTo == CaseStatus.CLOSED || resolvedTo == CaseStatus.CANCELLED,
            "resolvedTo must be CLOSED or CANCELLED"
        );

        c.status    = resolvedTo;
        c.updatedAt = block.timestamp;

        emit CaseDisputeResolved(caseId, resolvedTo, block.timestamp);
        emit CaseTransitioned(caseId, CaseStatus.DISPUTED, resolvedTo, block.timestamp);

        if (resolvedTo == CaseStatus.CLOSED) {
            emit CaseClosed(caseId, block.timestamp);
        } else {
            emit CaseCancelled(caseId, resolution, block.timestamp);
        }
    }

    // --------------------------------------------------------
    // Internal：狀態機轉換規則
    // --------------------------------------------------------

    function _isValidTransition(
        CaseType   caseType,
        CaseStatus current,
        CaseStatus next
    ) internal pure returns (bool) {
        if (current == CaseStatus.OPEN    && next == CaseStatus.MATCHED) return true;
        if (current == CaseStatus.MATCHED && next == CaseStatus.SIGN)    return true;

        if (caseType == CaseType.RENT) {
            // RENT: OPEN → MATCHED → SIGN → CLOSED
            if (current == CaseStatus.SIGN && next == CaseStatus.CLOSED) return true;
        }

        if (caseType == CaseType.SALE) {
            // SALE: OPEN → MATCHED → SIGN → BANKING → CLOSED
            if (current == CaseStatus.SIGN    && next == CaseStatus.BANKING) return true;
            if (current == CaseStatus.BANKING && next == CaseStatus.CLOSED)  return true;
        }

        return false;
    }

    // --------------------------------------------------------
    // View
    // --------------------------------------------------------

    function getCase(bytes32 caseId) external view returns (CaseInfo memory) {
        return cases[caseId];
    }

    function getCaseStatus(bytes32 caseId) external view returns (CaseStatus) {
        return cases[caseId].status;
    }

    function isAgentIntroduced(bytes32 caseId) external view returns (bool) {
        return cases[caseId].introducedByAgent != address(0);
    }
}

import assert from "node:assert/strict";
import {
    getSnapshotActionCopy,
    shouldRenderForm,
    shouldRenderSnapshot,
    type CredentialDetailLike,
} from "../src/components/credential/credentialViewState.js";

const failedDetail: CredentialDetailLike = { displayStatus: "FAILED" };
const manualReviewingDetail: CredentialDetailLike = { displayStatus: "MANUAL_REVIEWING" };
const notStartedDetail: CredentialDetailLike = { displayStatus: "NOT_STARTED" };

assert.equal(shouldRenderSnapshot(failedDetail, false), true, "failed result should stay on snapshot page");
assert.equal(shouldRenderForm(failedDetail, false), false, "failed result should not show form by default");
assert.equal(shouldRenderForm(failedDetail, true), true, "restart review should reopen the form");

assert.equal(shouldRenderSnapshot(manualReviewingDetail, false), true, "manual review should stay on snapshot page");
assert.equal(shouldRenderForm(manualReviewingDetail, false), false, "manual review should not reopen the form");

assert.equal(shouldRenderSnapshot(notStartedDetail, false), false, "not started should not render snapshot");
assert.equal(shouldRenderForm(notStartedDetail, false), true, "not started should render the form");
assert.equal(shouldRenderForm(undefined, false), true, "missing detail should render the form");

const failedCopy = getSnapshotActionCopy("FAILED");
assert.equal(failedCopy.title, "可以重新送審", "failed copy title should guide retry actions");
assert.match(failedCopy.description, /智能審核|人工審核|重新開/, "failed copy should mention retry paths");

console.log("credentialViewState tests passed");

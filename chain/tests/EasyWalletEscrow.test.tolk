import "@acton/emulation/network"
import "@acton/emulation/testing"
import "@acton/testing/expect"
import "@contracts/types"
import "@wrappers/EasyWalletEscrow.gen"

const TEST_NOW = 1700000000
const TEST_DEAL_ID = 42
const TEST_REVIEW_WINDOW = 3600

struct EscrowFixture {
    contract: EasyWalletEscrow
    buyer: Treasury
    seller: Treasury
    arbitrator: Treasury
    platform: Treasury
    outsider: Treasury
    baseAmount: coins
    buyerFee: coins
    sellerFee: coins
    buyerTotal: coins
    sellerProceeds: coins
    platformFee: coins
    fundingValue: coins
    deliveryDeadline: uint32
}

fun setupEscrow(): EscrowFixture {
    testing.setNow(TEST_NOW);

    val buyer = testing.treasury("buyer");
    val seller = testing.treasury("seller");
    val arbitrator = testing.treasury("arbitrator");
    val platform = testing.treasury("platform");
    val outsider = testing.treasury("outsider");

    val baseAmount = ton("5");
    val buyerFee = ton("0.05");
    val sellerFee = ton("0.05");
    val buyerTotal = ton("5.05");
    val sellerProceeds = ton("4.95");
    val platformFee = ton("0.1");
    val fundingValue = ton("5.17");
    val deliveryDeadline = TEST_NOW + 86400;

    val contract = EasyWalletEscrow.fromStorage({
        dealId: TEST_DEAL_ID,
        buyerSide: EscrowBuyerSide {
            buyer: buyer.address,
            arbitrator: arbitrator.address,
        }.toCell(),
        sellerSide: EscrowSellerSide {
            seller: seller.address,
            platformFeeRecipient: platform.address,
        }.toCell(),
        amounts: EscrowAmounts {
            baseAmount,
            buyerFee,
            sellerFee,
            buyerTotal,
            sellerProceeds,
            platformFee,
        }.toCell(),
        deliveryDeadline,
        reviewWindow: TEST_REVIEW_WINDOW,
        reviewDeadline: 0,
        deliveredEvidenceHash: 0,
        disputeReasonHash: 0,
        status: EscrowStatus.AwaitingFunding as uint8,
    });
    val deploy = contract.deploy(platform.address, { value: ton("0.2") });
    expect(deploy).toHaveSuccessfulDeploy({ to: contract.address });

    return EscrowFixture {
        contract,
        buyer,
        seller,
        arbitrator,
        platform,
        outsider,
        baseAmount,
        buyerFee,
        sellerFee,
        buyerTotal,
        sellerProceeds,
        platformFee,
        fundingValue,
        deliveryDeadline,
    };
}

fun fundEscrow(fixture: EscrowFixture) {
    val funded = fixture
        .contract
        .sendFundEscrow(
            fixture.buyer.address,
            1,
            { value: fixture.fundingValue },
        );
    expect(funded).toHaveSuccessfulTx<FundEscrow>({
        from: fixture.buyer.address,
        to: fixture.contract.address,
    });
    expect(funded).toHaveAllSuccessfulTxs();
}

get fun `test deployment exposes immutable terms and exact funding value`() {
    val fixture = setupEscrow();
    val data = fixture.contract.escrowData();

    expect(data.dealId).toEqual(TEST_DEAL_ID);
    expect(data.status).toEqual(EscrowStatus.AwaitingFunding as uint8);
    expect(data.reviewDeadline).toEqual(0);
    expect(fixture.contract.expectedFundingValue()).toEqual(fixture.fundingValue);
}

get fun `test wallet can deploy and fund escrow atomically`() {
    testing.setNow(TEST_NOW);
    val buyer = testing.treasury("atomic-buyer");
    val seller = testing.treasury("atomic-seller");
    val arbitrator = testing.treasury("atomic-arbitrator");
    val platform = testing.treasury("atomic-platform");
    val contract = EasyWalletEscrow.fromStorage({
        dealId: TEST_DEAL_ID,
        buyerSide: EscrowBuyerSide {
            buyer: buyer.address,
            arbitrator: arbitrator.address,
        }.toCell(),
        sellerSide: EscrowSellerSide {
            seller: seller.address,
            platformFeeRecipient: platform.address,
        }.toCell(),
        amounts: EscrowAmounts {
            baseAmount: ton("5"),
            buyerFee: ton("0.05"),
            sellerFee: ton("0.05"),
            buyerTotal: ton("5.05"),
            sellerProceeds: ton("4.95"),
            platformFee: ton("0.1"),
        }.toCell(),
        deliveryDeadline: TEST_NOW + 86400,
        reviewWindow: TEST_REVIEW_WINDOW,
        reviewDeadline: 0,
        deliveredEvidenceHash: 0,
        disputeReasonHash: 0,
        status: EscrowStatus.AwaitingFunding as uint8,
    });
    val deployAndFund = createMessage({
        bounce: BounceMode.NoBounce,
        value: ton("5.17"),
        dest: { stateInit: contract.stateInit! },
        body: FundEscrow { queryId: 1 },
    });
    val result = net.send(buyer.address, deployAndFund);

    expect(result).toHaveSuccessfulDeploy({ to: contract.address });
    expect(result).toHaveSuccessfulTx<FundEscrow>({
        from: buyer.address,
        to: contract.address,
    });
    expect(result).toHaveAllSuccessfulTxs();
    expect(contract.escrowData().status).toEqual(EscrowStatus.Funded as uint8);
}

get fun `test only buyer can fund with exact value`() {
    val fixture = setupEscrow();
    val unauthorized = fixture
        .contract
        .sendFundEscrow(
            fixture.outsider.address,
            1,
            { value: fixture.fundingValue },
        );
    expect(unauthorized).toHaveFailedTx<FundEscrow>({
        from: fixture.outsider.address,
        to: fixture.contract.address,
        exitCode: EscrowErrors.NotBuyer,
    });
    expect(fixture.contract.escrowData().status).toEqual(
        EscrowStatus.AwaitingFunding as uint8,
    );

    val wrongValue = fixture
        .contract
        .sendFundEscrow(
            fixture.buyer.address,
            2,
            { value: fixture.fundingValue - 1 },
        );
    expect(wrongValue).toHaveFailedTx<FundEscrow>({
        from: fixture.buyer.address,
        to: fixture.contract.address,
        exitCode: EscrowErrors.InvalidFunding,
    });
    expect(fixture.contract.escrowData().status).toEqual(
        EscrowStatus.AwaitingFunding as uint8,
    );

    fundEscrow(fixture);
    expect(fixture.contract.escrowData().status).toEqual(EscrowStatus.Funded as uint8);
}

get fun `test seller delivery and buyer confirmation release fixed payouts`() {
    val fixture = setupEscrow();
    fundEscrow(fixture);

    val delivered = fixture
        .contract
        .sendMarkDelivered(
            fixture.seller.address,
            2,
            0x1234,
            { value: ton("0.05") },
        );
    expect(delivered).toHaveSuccessfulTx<MarkDelivered>({
        from: fixture.seller.address,
        to: fixture.contract.address,
    });
    val deliveredData = fixture.contract.escrowData();
    expect(deliveredData.status).toEqual(EscrowStatus.Delivered as uint8);
    expect(deliveredData.deliveredEvidenceHash).toEqual(0x1234);
    expect(deliveredData.reviewDeadline).toEqual(TEST_NOW + TEST_REVIEW_WINDOW);

    val released = fixture
        .contract
        .sendConfirmDelivery(
            fixture.buyer.address,
            3,
            { value: ton("0.05") },
        );
    expect(released).toHaveSuccessfulTx<ConfirmDelivery>({
        from: fixture.buyer.address,
        to: fixture.contract.address,
    });
    expect(released).toHaveTx<EscrowPayout>({
        from: fixture.contract.address,
        to: fixture.seller.address,
        value: fixture.sellerProceeds,
    });
    expect(released).toHaveTx<EscrowPayout>({
        from: fixture.contract.address,
        to: fixture.platform.address,
        value: fixture.platformFee,
    });
    expect(released).toHaveTx<EscrowPayout>({
        from: fixture.contract.address,
        to: fixture.buyer.address,
    });
    expect(released).toHaveAllSuccessfulTxs();
    expect(testing.isDeployed(fixture.contract.address)).toBeFalse();
}

get fun `test buyer can refund an undelivered expired escrow`() {
    val fixture = setupEscrow();
    fundEscrow(fixture);
    testing.setNow(fixture.deliveryDeadline + 1);

    val refunded = fixture
        .contract
        .sendRefundExpired(
            fixture.buyer.address,
            4,
            { value: ton("0.05") },
        );
    expect(refunded).toHaveSuccessfulTx<RefundExpired>({
        from: fixture.buyer.address,
        to: fixture.contract.address,
    });
    expect(refunded).toHaveTx<EscrowPayout>({
        from: fixture.contract.address,
        to: fixture.buyer.address,
    });
    expect(refunded).toHaveAllSuccessfulTxs();
    expect(testing.isDeployed(fixture.contract.address)).toBeFalse();
}

get fun `test either party can dispute but only arbitrator can resolve`() {
    val fixture = setupEscrow();
    fundEscrow(fixture);

    val disputed = fixture
        .contract
        .sendOpenDispute(
            fixture.buyer.address,
            5,
            0x5678,
            { value: ton("0.05") },
        );
    expect(disputed).toHaveSuccessfulTx<OpenDispute>({
        from: fixture.buyer.address,
        to: fixture.contract.address,
    });
    expect(fixture.contract.escrowData().disputeReasonHash).toEqual(0x5678);

    val unauthorized = fixture
        .contract
        .sendResolveDispute(
            fixture.outsider.address,
            6,
            true,
            { value: ton("0.05") },
        );
    expect(unauthorized).toHaveFailedTx<ResolveDispute>({
        from: fixture.outsider.address,
        to: fixture.contract.address,
        exitCode: EscrowErrors.NotArbitrator,
    });
    expect(fixture.contract.escrowData().status).toEqual(EscrowStatus.Disputed as uint8);

    val resolved = fixture
        .contract
        .sendResolveDispute(
            fixture.arbitrator.address,
            7,
            true,
            { value: ton("0.05") },
        );
    expect(resolved).toHaveTx<EscrowPayout>({
        from: fixture.contract.address,
        to: fixture.seller.address,
        value: fixture.sellerProceeds,
    });
    expect(resolved).toHaveTx<EscrowPayout>({
        from: fixture.contract.address,
        to: fixture.platform.address,
        value: fixture.platformFee,
    });
    expect(resolved).toHaveAllSuccessfulTxs();
    expect(testing.isDeployed(fixture.contract.address)).toBeFalse();
}

get fun `test review timeout allows permissionless release`() {
    val fixture = setupEscrow();
    fundEscrow(fixture);
    fixture
        .contract
        .sendMarkDelivered(
            fixture.seller.address,
            8,
            0x9999,
            { value: ton("0.05") },
        );
    testing.setNow(TEST_NOW + TEST_REVIEW_WINDOW + 1);

    val released = fixture
        .contract
        .sendReleaseAfterReview(
            fixture.outsider.address,
            9,
            { value: ton("0.05") },
        );
    expect(released).toHaveSuccessfulTx<ReleaseAfterReview>({
        from: fixture.outsider.address,
        to: fixture.contract.address,
    });
    expect(released).toHaveTx<EscrowPayout>({
        from: fixture.contract.address,
        to: fixture.seller.address,
        value: fixture.sellerProceeds,
    });
    expect(released).toHaveAllSuccessfulTxs();
    expect(testing.isDeployed(fixture.contract.address)).toBeFalse();
}

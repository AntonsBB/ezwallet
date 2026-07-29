import "types"

const FEE_BPS = 100
const BPS_DENOMINATOR = 10000
const FUNDING_GAS_RESERVE = ton("0.12")
const MIN_REVIEW_WINDOW = 3600
const MAX_REVIEW_WINDOW = 2592000

contract EasyWalletEscrow {
    author: "Easy Wallet"
    version: "0.1.0"
    description: "Per-deal non-custodial escrow for native TON settlement"
    storage: EscrowStorage
    incomingMessages: EscrowMessage
    outgoingMessages: EscrowPayout
    thrownErrors: EscrowErrors
}

fun expectedPartyFee(baseAmount: coins): coins {
    return (baseAmount * FEE_BPS + BPS_DENOMINATOR - 1) / BPS_DENOMINATOR;
}

fun validateTerms(storage: EscrowStorage) {
    val buyerSide = lazy storage.buyerSide.load();
    val sellerSide = lazy storage.sellerSide.load();
    val amounts = lazy storage.amounts.load();
    val partyFee = expectedPartyFee(amounts.baseAmount);
    assert (amounts.baseAmount > 0) throw EscrowErrors.InvalidTerms;
    assert (partyFee > 0 && partyFee < amounts.baseAmount) throw EscrowErrors.InvalidTerms;
    assert (amounts.buyerFee == partyFee) throw EscrowErrors.InvalidTerms;
    assert (amounts.sellerFee == partyFee) throw EscrowErrors.InvalidTerms;
    assert (
        amounts.buyerTotal == amounts.baseAmount + amounts.buyerFee
    ) throw EscrowErrors.InvalidTerms;
    assert (
        amounts.sellerProceeds == amounts.baseAmount - amounts.sellerFee
    ) throw EscrowErrors.InvalidTerms;
    assert (
        amounts.platformFee == amounts.buyerFee + amounts.sellerFee
    ) throw EscrowErrors.InvalidTerms;
    assert (
        amounts.sellerProceeds + amounts.platformFee == amounts.buyerTotal
    ) throw EscrowErrors.InvalidTerms;
    assert (buyerSide.buyer != sellerSide.seller) throw EscrowErrors.InvalidTerms;
    assert (buyerSide.buyer != buyerSide.arbitrator) throw EscrowErrors.InvalidTerms;
    assert (buyerSide.buyer != sellerSide.platformFeeRecipient) throw EscrowErrors.InvalidTerms;
    assert (sellerSide.seller != buyerSide.arbitrator) throw EscrowErrors.InvalidTerms;
    assert (sellerSide.seller != sellerSide.platformFeeRecipient) throw EscrowErrors.InvalidTerms;
    assert (
        buyerSide.arbitrator != sellerSide.platformFeeRecipient
    ) throw EscrowErrors.InvalidTerms;
    assert (storage.deliveryDeadline > blockchain.now()) throw EscrowErrors.InvalidTerms;
    assert (
        storage.reviewWindow >= MIN_REVIEW_WINDOW && storage.reviewWindow <= MAX_REVIEW_WINDOW
    ) throw EscrowErrors.InvalidTerms;
}

fun releaseToSeller(mutate storage: EscrowStorage, queryId: uint64) {
    val buyerSide = lazy storage.buyerSide.load();
    val sellerSide = lazy storage.sellerSide.load();
    val amounts = lazy storage.amounts.load();
    storage.status = EscrowStatus.Released as uint8;
    storage.save();

    val sellerPayout = createMessage({
        bounce: BounceMode.NoBounce,
        value: amounts.sellerProceeds,
        dest: sellerSide.seller,
        body: EscrowPayout {
            queryId,
            dealId: storage.dealId,
            payoutKind: 1,
        },
    });
    sellerPayout.send(SEND_MODE_PAY_FEES_SEPARATELY);

    val platformPayout = createMessage({
        bounce: BounceMode.NoBounce,
        value: amounts.platformFee,
        dest: sellerSide.platformFeeRecipient,
        body: EscrowPayout {
            queryId,
            dealId: storage.dealId,
            payoutKind: 2,
        },
    });
    platformPayout.send(SEND_MODE_PAY_FEES_SEPARATELY);

    val buyerRemainder = createMessage({
        bounce: BounceMode.NoBounce,
        value: 0,
        dest: buyerSide.buyer,
        body: EscrowPayout {
            queryId,
            dealId: storage.dealId,
            payoutKind: 3,
        },
    });
    // SAFETY: fixed seller and platform payouts are queued first; the terminal contract has no
    // further valid state, so every remaining nanoton belongs to the buyer and the cell can close.
    buyerRemainder.send(SEND_MODE_CARRY_ALL_BALANCE | SEND_MODE_DESTROY);
}

fun refundBuyer(mutate storage: EscrowStorage, queryId: uint64) {
    val buyerSide = lazy storage.buyerSide.load();
    storage.status = EscrowStatus.Refunded as uint8;
    storage.save();

    val buyerRefund = createMessage({
        bounce: BounceMode.NoBounce,
        value: 0,
        dest: buyerSide.buyer,
        body: EscrowPayout {
            queryId,
            dealId: storage.dealId,
            payoutKind: 4,
        },
    });
    // SAFETY: refund is terminal and no other payout is queued, so the full balance belongs to the
    // buyer; destroying the emptied per-deal contract prevents stale escrow reuse.
    buyerRefund.send(SEND_MODE_CARRY_ALL_BALANCE | SEND_MODE_DESTROY);
}

fun onInternalMessage(in: InMessage) {
    val msg = lazy EscrowMessage.fromSlice(in.body);
    var storage = lazy EscrowStorage.load();

    match (msg) {
        FundEscrow => {
            val buyerSide = lazy storage.buyerSide.load();
            val amounts = lazy storage.amounts.load();
            assert (
                storage.status == (EscrowStatus.AwaitingFunding as uint8)
            ) throw EscrowErrors.InvalidState;
            assert (in.senderAddress == buyerSide.buyer) throw EscrowErrors.NotBuyer;
            validateTerms(storage);
            assert (
                in.valueCoins == amounts.buyerTotal + FUNDING_GAS_RESERVE
            ) throw EscrowErrors.InvalidFunding;

            storage.status = EscrowStatus.Funded as uint8;
            storage.save();
        }
        MarkDelivered => {
            val sellerSide = lazy storage.sellerSide.load();
            assert (
                storage.status == (EscrowStatus.Funded as uint8)
            ) throw EscrowErrors.InvalidState;
            assert (in.senderAddress == sellerSide.seller) throw EscrowErrors.NotSeller;
            assert (
                blockchain.now() <= storage.deliveryDeadline
            ) throw EscrowErrors.DeliveryDeadlinePassed;

            storage.status = EscrowStatus.Delivered as uint8;
            storage.reviewDeadline = blockchain.now() + storage.reviewWindow;
            storage.deliveredEvidenceHash = msg.evidenceHash;
            storage.save();
        }
        ConfirmDelivery => {
            val buyerSide = lazy storage.buyerSide.load();
            assert (
                storage.status == (EscrowStatus.Delivered as uint8)
            ) throw EscrowErrors.InvalidState;
            assert (in.senderAddress == buyerSide.buyer) throw EscrowErrors.NotBuyer;
            releaseToSeller(mutate storage, msg.queryId);
        }
        OpenDispute => {
            val buyerSide = lazy storage.buyerSide.load();
            val sellerSide = lazy storage.sellerSide.load();
            assert (
                storage.status == (EscrowStatus.Funded as uint8) ||
                storage.status == (EscrowStatus.Delivered as uint8)
            ) throw EscrowErrors.InvalidState;
            assert (
                in.senderAddress == buyerSide.buyer || in.senderAddress == sellerSide.seller
            ) throw EscrowErrors.NotParty;

            storage.status = EscrowStatus.Disputed as uint8;
            storage.disputeReasonHash = msg.reasonHash;
            storage.save();
        }
        RefundExpired => {
            val buyerSide = lazy storage.buyerSide.load();
            assert (
                storage.status == (EscrowStatus.Funded as uint8)
            ) throw EscrowErrors.InvalidState;
            assert (in.senderAddress == buyerSide.buyer) throw EscrowErrors.NotBuyer;
            assert (
                blockchain.now() > storage.deliveryDeadline
            ) throw EscrowErrors.DeliveryDeadlineNotReached;
            refundBuyer(mutate storage, msg.queryId);
        }
        ReleaseAfterReview => {
            assert (
                storage.status == (EscrowStatus.Delivered as uint8)
            ) throw EscrowErrors.InvalidState;
            assert (
                blockchain.now() > storage.reviewDeadline
            ) throw EscrowErrors.ReviewDeadlineNotReached;
            releaseToSeller(mutate storage, msg.queryId);
        }
        ResolveDispute => {
            val buyerSide = lazy storage.buyerSide.load();
            assert (
                storage.status == (EscrowStatus.Disputed as uint8)
            ) throw EscrowErrors.InvalidState;
            assert (in.senderAddress == buyerSide.arbitrator) throw EscrowErrors.NotArbitrator;
            if (msg.releaseToSeller) {
                releaseToSeller(mutate storage, msg.queryId);
            } else {
                refundBuyer(mutate storage, msg.queryId);
            }
        }
        else => {
            assert (in.body.isEmpty()) throw EscrowErrors.InvalidMessage;
        }
    }
}

fun onBouncedMessage(_in: InMessageBounced) {}

get fun escrowData(): EscrowStorage {
    return EscrowStorage.load();
}

get fun expectedFundingValue(): coins {
    val storage = lazy EscrowStorage.load();
    val amounts = lazy storage.amounts.load();
    return amounts.buyerTotal + FUNDING_GAS_RESERVE;
}

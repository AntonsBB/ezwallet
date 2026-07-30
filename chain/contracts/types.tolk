enum EscrowErrors {
    InvalidState = 100
    NotBuyer = 101
    NotSeller = 102
    NotParty = 103
    NotArbitrator = 104
    InvalidFunding = 105
    InvalidTerms = 106
    DeliveryDeadlineNotReached = 107
    ReviewDeadlineNotReached = 108
    DeliveryDeadlinePassed = 109
    InvalidMessage = 0xFFFF
}

enum EscrowStatus {
    AwaitingFunding = 0
    Funded = 1
    Delivered = 2
    Disputed = 3
    Released = 4
    Refunded = 5
}

struct EscrowBuyerSide {
    buyer: address
    arbitrator: address
}

struct EscrowSellerSide {
    seller: address
    platformFeeRecipient: address
}

struct EscrowAmounts {
    baseAmount: coins
    buyerFee: coins
    sellerFee: coins
    buyerTotal: coins
    sellerProceeds: coins
    platformFee: coins
}

struct EscrowStorage {
    dealId: uint256
    buyerSide: Cell<EscrowBuyerSide>
    sellerSide: Cell<EscrowSellerSide>
    amounts: Cell<EscrowAmounts>
    deliveryDeadline: uint32
    reviewWindow: uint32
    reviewDeadline: uint32
    deliveredEvidenceHash: uint256
    disputeReasonHash: uint256
    status: uint8
}

fun EscrowStorage.load(): EscrowStorage {
    return EscrowStorage.fromCell(contract.getData());
}

fun EscrowStorage.save(self) {
    contract.setData(self.toCell());
}

struct (0xf1555c01) FundEscrow {
    queryId: uint64
}

struct (0xd3116e02) MarkDelivered {
    queryId: uint64
    evidenceHash: uint256
}

struct (0xc0f1d003) ConfirmDelivery {
    queryId: uint64
}

struct (0xd15f0e04) OpenDispute {
    queryId: uint64
    reasonHash: uint256
}

struct (0x3ef00d05) RefundExpired {
    queryId: uint64
}

struct (0xa1700e06) ReleaseAfterReview {
    queryId: uint64
}

struct (0xae501e07) ResolveDispute {
    queryId: uint64
    releaseToSeller: bool
}

struct (0xea5e0008) EscrowPayout {
    queryId: uint64
    dealId: uint256
    payoutKind: uint8
}

type EscrowMessage =
    | FundEscrow
    | MarkDelivered
    | ConfirmDelivery
    | OpenDispute
    | RefundExpired
    | ReleaseAfterReview
    | ResolveDispute

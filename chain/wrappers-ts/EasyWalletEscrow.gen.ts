// AUTO-GENERATED, do not edit
// It's a TypeScript wrapper for a EasyWalletEscrow contract in Tolk.
/* eslint-disable */

import * as c from '@ton/core';
import { beginCell, ContractProvider, Sender, SendMode } from '@ton/core';

// ————————————————————————————————————————————
//   predefined types and functions
//

type StoreCallback<T> = (obj: T, b: c.Builder) => void
type LoadCallback<T> = (s: c.Slice) => T

export type CellRef<T> = {
    ref: T
}

function makeCellFrom<T>(self: T, storeFn_T: StoreCallback<T>): c.Cell {
    let b = beginCell();
    storeFn_T(self, b);
    return b.endCell();
}

function loadAndCheckPrefix32(s: c.Slice, expected: number, structName: string): void {
    let prefix = s.loadUint(32);
    if (prefix !== expected) {
        throw new Error(`Incorrect prefix for '${structName}': expected 0x${expected.toString(16).padStart(8, '0')}, got 0x${prefix.toString(16).padStart(8, '0')}`);
    }
}

function lookupPrefix(s: c.Slice, expected: number, prefixLen: number): boolean {
    return s.remainingBits >= prefixLen && s.preloadUint(prefixLen) === expected;
}

function throwNonePrefixMatch(fieldPath: string): never {
    throw new Error(`Incorrect prefix for '${fieldPath}': none of variants matched`);
}

function storeCellRef<T>(cell: CellRef<T>, b: c.Builder, storeFn_T: StoreCallback<T>): void {
    let b_ref = c.beginCell();
    storeFn_T(cell.ref, b_ref);
    b.storeRef(b_ref.endCell());
}

function loadCellRef<T>(s: c.Slice, loadFn_T: LoadCallback<T>): CellRef<T> {
    let s_ref = s.loadRef().beginParse();
    return { ref: loadFn_T(s_ref) };
}

function storeTolkNullable<T>(v: T | null, b: c.Builder, storeFn_T: StoreCallback<T>): void {
    if (v === null) {
        b.storeUint(0, 1);
    } else {
        b.storeUint(1, 1);
        storeFn_T(v, b);
    }
}

// ————————————————————————————————————————————
//   parse get methods result from a TVM stack
//

class StackReader {
    constructor(private tuple: c.TupleItem[]) {
    }

    static fromGetMethod(expectedN: number, getMethodResult: { stack: c.TupleReader }): StackReader {
        let tuple = [] as c.TupleItem[];
        while (getMethodResult.stack.remaining) {
            tuple.push(getMethodResult.stack.pop());
        }
        if (tuple.length !== expectedN) {
            throw new Error(`expected ${expectedN} stack width, got ${tuple.length}`);
        }
        return new StackReader(tuple);
    }

    private popExpecting<ItemT>(itemType: string): ItemT {
        const item = this.tuple.shift();
        if (item?.type === itemType) {
            return item as ItemT;
        }
        throw new Error(`not '${itemType}' on a stack`);
    }

    private popCellLike(): c.Cell {
        const item = this.tuple.shift();
        if (item && (item.type === 'cell' || item.type === 'slice' || item.type === 'builder')) {
            return item.cell;
        }
        throw new Error(`not cell/slice on a stack`);
    }

    readBigInt(): bigint {
        return this.popExpecting<c.TupleItemInt>('int').value;
    }

    readBoolean(): boolean {
        return this.popExpecting<c.TupleItemInt>('int').value !== 0n;
    }

    readCell(): c.Cell {
        return this.popCellLike();
    }

    readSlice(): c.Slice {
        return this.popCellLike().beginParse();
    }

    readCellRef<T>(loadFn_T: LoadCallback<T>): CellRef<T> {
        return { ref: loadFn_T(this.readCell().beginParse()) };
    }
}

// ————————————————————————————————————————————
//   auto-generated serializers to/from cells
//

type coins = bigint

type uint8 = bigint
type uint32 = bigint
type uint64 = bigint
type uint256 = bigint

/**
 > enum EscrowErrors { 11 variants }
 */
export type EscrowErrors = bigint

export const EscrowErrors = {
    InvalidState: 100n,
    NotBuyer: 101n,
    NotSeller: 102n,
    NotParty: 103n,
    NotArbitrator: 104n,
    InvalidFunding: 105n,
    InvalidTerms: 106n,
    DeliveryDeadlineNotReached: 107n,
    ReviewDeadlineNotReached: 108n,
    DeliveryDeadlinePassed: 109n,
    InvalidMessage: 65535n,

    fromSlice(s: c.Slice): EscrowErrors {
        return s.loadUintBig(16);
    },
    store(self: EscrowErrors, b: c.Builder): void {
        b.storeUint(self, 16);
    },
    toCell(self: EscrowErrors): c.Cell {
        return makeCellFrom<EscrowErrors>(self, EscrowErrors.store);
    }
}

/**
 > struct EscrowBuyerSide {
 >     buyer: address
 >     arbitrator: address
 > }
 */
export interface EscrowBuyerSide {
    readonly $: 'EscrowBuyerSide'
    buyer: c.Address
    arbitrator: c.Address
}

export const EscrowBuyerSide = {
    create(args: {
        buyer: c.Address
        arbitrator: c.Address
    }): EscrowBuyerSide {
        return {
            $: 'EscrowBuyerSide',
            ...args
        }
    },
    fromSlice(s: c.Slice): EscrowBuyerSide {
        return {
            $: 'EscrowBuyerSide',
            buyer: s.loadAddress(),
            arbitrator: s.loadAddress(),
        }
    },
    store(self: EscrowBuyerSide, b: c.Builder): void {
        b.storeAddress(self.buyer);
        b.storeAddress(self.arbitrator);
    },
    toCell(self: EscrowBuyerSide): c.Cell {
        return makeCellFrom<EscrowBuyerSide>(self, EscrowBuyerSide.store);
    }
}

/**
 > struct EscrowSellerSide {
 >     seller: address
 >     platformFeeRecipient: address
 > }
 */
export interface EscrowSellerSide {
    readonly $: 'EscrowSellerSide'
    seller: c.Address
    platformFeeRecipient: c.Address
}

export const EscrowSellerSide = {
    create(args: {
        seller: c.Address
        platformFeeRecipient: c.Address
    }): EscrowSellerSide {
        return {
            $: 'EscrowSellerSide',
            ...args
        }
    },
    fromSlice(s: c.Slice): EscrowSellerSide {
        return {
            $: 'EscrowSellerSide',
            seller: s.loadAddress(),
            platformFeeRecipient: s.loadAddress(),
        }
    },
    store(self: EscrowSellerSide, b: c.Builder): void {
        b.storeAddress(self.seller);
        b.storeAddress(self.platformFeeRecipient);
    },
    toCell(self: EscrowSellerSide): c.Cell {
        return makeCellFrom<EscrowSellerSide>(self, EscrowSellerSide.store);
    }
}

/**
 > struct EscrowAmounts {
 >     baseAmount: coins
 >     buyerFee: coins
 >     sellerFee: coins
 >     buyerTotal: coins
 >     sellerProceeds: coins
 >     platformFee: coins
 > }
 */
export interface EscrowAmounts {
    readonly $: 'EscrowAmounts'
    baseAmount: coins
    buyerFee: coins
    sellerFee: coins
    buyerTotal: coins
    sellerProceeds: coins
    platformFee: coins
}

export const EscrowAmounts = {
    create(args: {
        baseAmount: coins
        buyerFee: coins
        sellerFee: coins
        buyerTotal: coins
        sellerProceeds: coins
        platformFee: coins
    }): EscrowAmounts {
        return {
            $: 'EscrowAmounts',
            ...args
        }
    },
    fromSlice(s: c.Slice): EscrowAmounts {
        return {
            $: 'EscrowAmounts',
            baseAmount: s.loadCoins(),
            buyerFee: s.loadCoins(),
            sellerFee: s.loadCoins(),
            buyerTotal: s.loadCoins(),
            sellerProceeds: s.loadCoins(),
            platformFee: s.loadCoins(),
        }
    },
    store(self: EscrowAmounts, b: c.Builder): void {
        b.storeCoins(self.baseAmount);
        b.storeCoins(self.buyerFee);
        b.storeCoins(self.sellerFee);
        b.storeCoins(self.buyerTotal);
        b.storeCoins(self.sellerProceeds);
        b.storeCoins(self.platformFee);
    },
    toCell(self: EscrowAmounts): c.Cell {
        return makeCellFrom<EscrowAmounts>(self, EscrowAmounts.store);
    }
}

/**
 > struct EscrowStorage {
 >     dealId: uint256
 >     buyerSide: Cell<EscrowBuyerSide>
 >     sellerSide: Cell<EscrowSellerSide>
 >     amounts: Cell<EscrowAmounts>
 >     deliveryDeadline: uint32
 >     reviewWindow: uint32
 >     reviewDeadline: uint32
 >     deliveredEvidenceHash: uint256
 >     disputeReasonHash: uint256
 >     status: uint8
 > }
 */
export interface EscrowStorage {
    readonly $: 'EscrowStorage'
    dealId: uint256
    buyerSide: CellRef<EscrowBuyerSide>
    sellerSide: CellRef<EscrowSellerSide>
    amounts: CellRef<EscrowAmounts>
    deliveryDeadline: uint32
    reviewWindow: uint32
    reviewDeadline: uint32
    deliveredEvidenceHash: uint256
    disputeReasonHash: uint256
    status: uint8
}

export const EscrowStorage = {
    create(args: {
        dealId: uint256
        buyerSide: CellRef<EscrowBuyerSide>
        sellerSide: CellRef<EscrowSellerSide>
        amounts: CellRef<EscrowAmounts>
        deliveryDeadline: uint32
        reviewWindow: uint32
        reviewDeadline: uint32
        deliveredEvidenceHash: uint256
        disputeReasonHash: uint256
        status: uint8
    }): EscrowStorage {
        return {
            $: 'EscrowStorage',
            ...args
        }
    },
    fromSlice(s: c.Slice): EscrowStorage {
        return {
            $: 'EscrowStorage',
            dealId: s.loadUintBig(256),
            buyerSide: loadCellRef<EscrowBuyerSide>(s, EscrowBuyerSide.fromSlice),
            sellerSide: loadCellRef<EscrowSellerSide>(s, EscrowSellerSide.fromSlice),
            amounts: loadCellRef<EscrowAmounts>(s, EscrowAmounts.fromSlice),
            deliveryDeadline: s.loadUintBig(32),
            reviewWindow: s.loadUintBig(32),
            reviewDeadline: s.loadUintBig(32),
            deliveredEvidenceHash: s.loadUintBig(256),
            disputeReasonHash: s.loadUintBig(256),
            status: s.loadUintBig(8),
        }
    },
    store(self: EscrowStorage, b: c.Builder): void {
        b.storeUint(self.dealId, 256);
        storeCellRef<EscrowBuyerSide>(self.buyerSide, b, EscrowBuyerSide.store);
        storeCellRef<EscrowSellerSide>(self.sellerSide, b, EscrowSellerSide.store);
        storeCellRef<EscrowAmounts>(self.amounts, b, EscrowAmounts.store);
        b.storeUint(self.deliveryDeadline, 32);
        b.storeUint(self.reviewWindow, 32);
        b.storeUint(self.reviewDeadline, 32);
        b.storeUint(self.deliveredEvidenceHash, 256);
        b.storeUint(self.disputeReasonHash, 256);
        b.storeUint(self.status, 8);
    },
    toCell(self: EscrowStorage): c.Cell {
        return makeCellFrom<EscrowStorage>(self, EscrowStorage.store);
    }
}

/**
 > struct (0xf1555c01) FundEscrow {
 >     queryId: uint64
 > }
 */
export interface FundEscrow {
    readonly $: 'FundEscrow'
    queryId: uint64
}

export const FundEscrow = {
    PREFIX: 0xf1555c01,

    create(args: {
        queryId: uint64
    }): FundEscrow {
        return {
            $: 'FundEscrow',
            ...args
        }
    },
    fromSlice(s: c.Slice): FundEscrow {
        loadAndCheckPrefix32(s, 0xf1555c01, 'FundEscrow');
        return {
            $: 'FundEscrow',
            queryId: s.loadUintBig(64),
        }
    },
    store(self: FundEscrow, b: c.Builder): void {
        b.storeUint(0xf1555c01, 32);
        b.storeUint(self.queryId, 64);
    },
    toCell(self: FundEscrow): c.Cell {
        return makeCellFrom<FundEscrow>(self, FundEscrow.store);
    }
}

/**
 > struct (0xd3116e02) MarkDelivered {
 >     queryId: uint64
 >     evidenceHash: uint256
 > }
 */
export interface MarkDelivered {
    readonly $: 'MarkDelivered'
    queryId: uint64
    evidenceHash: uint256
}

export const MarkDelivered = {
    PREFIX: 0xd3116e02,

    create(args: {
        queryId: uint64
        evidenceHash: uint256
    }): MarkDelivered {
        return {
            $: 'MarkDelivered',
            ...args
        }
    },
    fromSlice(s: c.Slice): MarkDelivered {
        loadAndCheckPrefix32(s, 0xd3116e02, 'MarkDelivered');
        return {
            $: 'MarkDelivered',
            queryId: s.loadUintBig(64),
            evidenceHash: s.loadUintBig(256),
        }
    },
    store(self: MarkDelivered, b: c.Builder): void {
        b.storeUint(0xd3116e02, 32);
        b.storeUint(self.queryId, 64);
        b.storeUint(self.evidenceHash, 256);
    },
    toCell(self: MarkDelivered): c.Cell {
        return makeCellFrom<MarkDelivered>(self, MarkDelivered.store);
    }
}

/**
 > struct (0xc0f1d003) ConfirmDelivery {
 >     queryId: uint64
 > }
 */
export interface ConfirmDelivery {
    readonly $: 'ConfirmDelivery'
    queryId: uint64
}

export const ConfirmDelivery = {
    PREFIX: 0xc0f1d003,

    create(args: {
        queryId: uint64
    }): ConfirmDelivery {
        return {
            $: 'ConfirmDelivery',
            ...args
        }
    },
    fromSlice(s: c.Slice): ConfirmDelivery {
        loadAndCheckPrefix32(s, 0xc0f1d003, 'ConfirmDelivery');
        return {
            $: 'ConfirmDelivery',
            queryId: s.loadUintBig(64),
        }
    },
    store(self: ConfirmDelivery, b: c.Builder): void {
        b.storeUint(0xc0f1d003, 32);
        b.storeUint(self.queryId, 64);
    },
    toCell(self: ConfirmDelivery): c.Cell {
        return makeCellFrom<ConfirmDelivery>(self, ConfirmDelivery.store);
    }
}

/**
 > struct (0xd15f0e04) OpenDispute {
 >     queryId: uint64
 >     reasonHash: uint256
 > }
 */
export interface OpenDispute {
    readonly $: 'OpenDispute'
    queryId: uint64
    reasonHash: uint256
}

export const OpenDispute = {
    PREFIX: 0xd15f0e04,

    create(args: {
        queryId: uint64
        reasonHash: uint256
    }): OpenDispute {
        return {
            $: 'OpenDispute',
            ...args
        }
    },
    fromSlice(s: c.Slice): OpenDispute {
        loadAndCheckPrefix32(s, 0xd15f0e04, 'OpenDispute');
        return {
            $: 'OpenDispute',
            queryId: s.loadUintBig(64),
            reasonHash: s.loadUintBig(256),
        }
    },
    store(self: OpenDispute, b: c.Builder): void {
        b.storeUint(0xd15f0e04, 32);
        b.storeUint(self.queryId, 64);
        b.storeUint(self.reasonHash, 256);
    },
    toCell(self: OpenDispute): c.Cell {
        return makeCellFrom<OpenDispute>(self, OpenDispute.store);
    }
}

/**
 > struct (0x3ef00d05) RefundExpired {
 >     queryId: uint64
 > }
 */
export interface RefundExpired {
    readonly $: 'RefundExpired'
    queryId: uint64
}

export const RefundExpired = {
    PREFIX: 0x3ef00d05,

    create(args: {
        queryId: uint64
    }): RefundExpired {
        return {
            $: 'RefundExpired',
            ...args
        }
    },
    fromSlice(s: c.Slice): RefundExpired {
        loadAndCheckPrefix32(s, 0x3ef00d05, 'RefundExpired');
        return {
            $: 'RefundExpired',
            queryId: s.loadUintBig(64),
        }
    },
    store(self: RefundExpired, b: c.Builder): void {
        b.storeUint(0x3ef00d05, 32);
        b.storeUint(self.queryId, 64);
    },
    toCell(self: RefundExpired): c.Cell {
        return makeCellFrom<RefundExpired>(self, RefundExpired.store);
    }
}

/**
 > struct (0xa1700e06) ReleaseAfterReview {
 >     queryId: uint64
 > }
 */
export interface ReleaseAfterReview {
    readonly $: 'ReleaseAfterReview'
    queryId: uint64
}

export const ReleaseAfterReview = {
    PREFIX: 0xa1700e06,

    create(args: {
        queryId: uint64
    }): ReleaseAfterReview {
        return {
            $: 'ReleaseAfterReview',
            ...args
        }
    },
    fromSlice(s: c.Slice): ReleaseAfterReview {
        loadAndCheckPrefix32(s, 0xa1700e06, 'ReleaseAfterReview');
        return {
            $: 'ReleaseAfterReview',
            queryId: s.loadUintBig(64),
        }
    },
    store(self: ReleaseAfterReview, b: c.Builder): void {
        b.storeUint(0xa1700e06, 32);
        b.storeUint(self.queryId, 64);
    },
    toCell(self: ReleaseAfterReview): c.Cell {
        return makeCellFrom<ReleaseAfterReview>(self, ReleaseAfterReview.store);
    }
}

/**
 > struct (0xae501e07) ResolveDispute {
 >     queryId: uint64
 >     releaseToSeller: bool
 > }
 */
export interface ResolveDispute {
    readonly $: 'ResolveDispute'
    queryId: uint64
    releaseToSeller: boolean
}

export const ResolveDispute = {
    PREFIX: 0xae501e07,

    create(args: {
        queryId: uint64
        releaseToSeller: boolean
    }): ResolveDispute {
        return {
            $: 'ResolveDispute',
            ...args
        }
    },
    fromSlice(s: c.Slice): ResolveDispute {
        loadAndCheckPrefix32(s, 0xae501e07, 'ResolveDispute');
        return {
            $: 'ResolveDispute',
            queryId: s.loadUintBig(64),
            releaseToSeller: s.loadBoolean(),
        }
    },
    store(self: ResolveDispute, b: c.Builder): void {
        b.storeUint(0xae501e07, 32);
        b.storeUint(self.queryId, 64);
        b.storeBit(self.releaseToSeller);
    },
    toCell(self: ResolveDispute): c.Cell {
        return makeCellFrom<ResolveDispute>(self, ResolveDispute.store);
    }
}

/**
 > struct (0xea5e0008) EscrowPayout {
 >     queryId: uint64
 >     dealId: uint256
 >     payoutKind: uint8
 > }
 */
export interface EscrowPayout {
    readonly $: 'EscrowPayout'
    queryId: uint64
    dealId: uint256
    payoutKind: uint8
}

export const EscrowPayout = {
    PREFIX: 0xea5e0008,

    create(args: {
        queryId: uint64
        dealId: uint256
        payoutKind: uint8
    }): EscrowPayout {
        return {
            $: 'EscrowPayout',
            ...args
        }
    },
    fromSlice(s: c.Slice): EscrowPayout {
        loadAndCheckPrefix32(s, 0xea5e0008, 'EscrowPayout');
        return {
            $: 'EscrowPayout',
            queryId: s.loadUintBig(64),
            dealId: s.loadUintBig(256),
            payoutKind: s.loadUintBig(8),
        }
    },
    store(self: EscrowPayout, b: c.Builder): void {
        b.storeUint(0xea5e0008, 32);
        b.storeUint(self.queryId, 64);
        b.storeUint(self.dealId, 256);
        b.storeUint(self.payoutKind, 8);
    },
    toCell(self: EscrowPayout): c.Cell {
        return makeCellFrom<EscrowPayout>(self, EscrowPayout.store);
    }
}

// ————————————————————————————————————————————
//    class EasyWalletEscrow
//

interface ExtraSendOptions {
    bounce?: boolean                    // default: false
    sendMode?: SendMode                 // default: SendMode.PAY_GAS_SEPARATELY
    extraCurrencies?: c.ExtraCurrency   // default: empty dict
}

interface DeployedAddrOptions {
    workchain?: number                  // default: 0 (basechain)
    toShard?: { fixedPrefixLength: number; closeTo: c.Address }
    overrideContractCode?: c.Cell
}

function calculateDeployedAddress(code: c.Cell, data: c.Cell, options: DeployedAddrOptions): c.Address {
    const stateInitCell = beginCell().store(c.storeStateInit({
        code,
        data,
        splitDepth: options.toShard?.fixedPrefixLength,
        special: null,
        libraries: null,
    })).endCell();

    let addrHash = stateInitCell.hash();
    if (options.toShard) {
        const shardDepth = options.toShard.fixedPrefixLength;
        addrHash = beginCell()
            .storeBits(new c.BitString(options.toShard.closeTo.hash, 0, shardDepth))
            .storeBits(new c.BitString(stateInitCell.hash(), shardDepth, 256 - shardDepth))
            .endCell()
            .beginParse().loadBuffer(32);
    }

    return new c.Address(options.workchain ?? 0, addrHash);
}

export class EasyWalletEscrow implements c.Contract {
    static CodeCell = c.Cell.fromBase64('te6ccgECEwEABawAART/APSkE/S88sgLAQIBYgIDA/jQ+JGRMOAg7UTQ0//U1NTTH9Mf0x/T/9P/1wsHCtcsJ4qq4AzjAtcsJpiLcBSOQ2wiOSTQCMAB8uBkB/pIMPiSxwXy4Gb4IyK78uBt+CMhoAjTPzHXC/8GyMv/FcwTzMzLH8sfE8sfEsv/y//PhArJ7VTg1ywmB46AHOMCBAUGAgFYERIB/jA6JtAl0Ary0GT6SDD4kscF8uBlJtAm0CbQ+gD6APoA+gD6APoAMCWnZIEnEKClgScQqQQmwgDy4GogwgCVUwa5wwCRcOLy4GpTULry4GokuvLgalNUoCO68uBqUVOhIbry4GpaoCO68uBqWKC68uBqAfpI+kgwAvpI+kgwUyEHAf47J9AqwAI7CvLgZAn6SDD4kscF8uBlCdcLPybQJtAm0CrIy/8qzxQ6UorMOFJozDZSRssfNFIkyx8yUgLLHzEnzwv/N1JXy/81BM+EEsntVPpI+kgwAvoAMfoAMfoAMfoAMfoA+gAwyM+FCBP6UgH6AoIQ6l4ACM8LiiXPCz8jCATmidcnjlQxOibQJtAqwAGSOn+VCsACwwDi8uBk+kgwCfpIMPiSUArHBZI4f5j4klAJxwXDAOLy4GcI0z8x1wv/BsjL/xXME8zMyx/LHxPLH8v/y//PhA7J7VTg1ywh94BoLOMC1ywlC4BwNOMC1ywlcoDwPAkKCwwA6scF8tBqUyPHBfLQalEixwXy0GpTAscF8tBqIccF8tBqxwXy0Goj+CO88uBqIoEOEL6ZIoIIJ40Au8MAkXDi8uBqCPoAMfoAMfoAMfoAMPiXAYIQBycOAKC68uBpBsjL/xXME8zMyx/LH8sfy//L/8+EBsntVACgzwv/z4QGyXH7AMjPhQgS+lIB+gKCEOpeAAjPC4ojzws/Ic8L/8+ECslx+wAB+kgwyM+FCPpSghDqXgAIzwuOEss/Ic8L/zHPhA7JgQCg+wAACNFfDgQA7jsn0CrAATsK8uBkCfpIMPiSxwXy4GX4IyS88uBrCdcLPybQKMjL/yjPFDhSaMw2UkbMNFIkyx8yUgLLHzEhzwsfMSXPC/81UjXL/zMCz4QWye1UAfpIMMjPhQj6UoIQ6l4ACM8LjhLLPyHPC/8xz4QSyYEAoPsAAf47KcACOgny4GT4IyK88uBsCdcLPybQJtAm0CrIy/8qzxQ6UorMOFJozDZSRssfNFIkyx8yUgLLHzEnzwv/N1JXy/81BM+EEsntVPpI+kgwAvoAMfoAMfoAMfoAMfoA+gAwyM+FCBP6UgH6AoIQ6l4ACM8LiiXPCz8jzwv/z4QGDQL8jvk7J9AqwAM7CvLgZAn6SDH6SDD4kscF8uBoCdM/1woAjlYm0CjIy/8ozxQ4UmjMNlJGzDRSJMsfMlICyx8xIc8LHzElzwv/NVI1y/8zAs+EFsntVAH6SDDIz4UI+lKCEOpeAAjPC44Syz8hzwv/Mc+EEsmBAKD7AOMN4F8LDg8AlMlx+wDIz4UIEvpSAfoCghDqXgAIzwuKI88LPyHPC//PhArJcfsAAfpIMMjPhQj6UoIQ6l4ACM8LjhLLPyHPC/8xz4QOyYEAoPsAAf4m0CbQJtAqyMv/Ks8UOlKKzDhSaMw2UkbLHzRSJMsfMlICyx8xJ88L/zdSV8v/NQTPhBLJ7VT6SPpIMAL6ADH6ADH6ADH6ADH6APoAMMjPhQgT+lIB+gKCEOpeAAjPC4olzws/I88L/8+EBslx+wDIz4UIEvpSAfoCghDqXgAIEAAOhA8BxwDy9ABszwuKI88LPyHPC//PhArJcfsAAfpIMMjPhQj6UoIQ6l4ACM8LjhLLPyHPC/8xz4QOyYEAoPsAAD+4L67UTQ1DHUMddM0PoAMfoAMfoAMfoAMIIQBycOAKCAAvu+0u1E0NP/1NTU0x/TH9Mf0//T/9MH0Y');

    static Errors = {
        'EscrowErrors.InvalidState': 100,
        'EscrowErrors.NotBuyer': 101,
        'EscrowErrors.NotSeller': 102,
        'EscrowErrors.NotParty': 103,
        'EscrowErrors.NotArbitrator': 104,
        'EscrowErrors.InvalidFunding': 105,
        'EscrowErrors.InvalidTerms': 106,
        'EscrowErrors.DeliveryDeadlineNotReached': 107,
        'EscrowErrors.ReviewDeadlineNotReached': 108,
        'EscrowErrors.DeliveryDeadlinePassed': 109,
        'EscrowErrors.InvalidMessage': 65535,
    }

    readonly address: c.Address
    readonly init: { code: c.Cell, data: c.Cell } | undefined

    protected constructor(address: c.Address, init?: { code: c.Cell, data: c.Cell }) {
        this.address = address;
        this.init = init;
    }

    static fromAddress(address: c.Address) {
        return new EasyWalletEscrow(address);
    }

    static fromStorage(emptyStorage: {
        dealId: uint256
        buyerSide: CellRef<EscrowBuyerSide>
        sellerSide: CellRef<EscrowSellerSide>
        amounts: CellRef<EscrowAmounts>
        deliveryDeadline: uint32
        reviewWindow: uint32
        reviewDeadline: uint32
        deliveredEvidenceHash: uint256
        disputeReasonHash: uint256
        status: uint8
    }, deployedOptions?: DeployedAddrOptions) {
        const initialState = {
            code: deployedOptions?.overrideContractCode ?? EasyWalletEscrow.CodeCell,
            data: EscrowStorage.toCell(EscrowStorage.create(emptyStorage)),
        };
        const address = calculateDeployedAddress(initialState.code, initialState.data, deployedOptions ?? {});
        return new EasyWalletEscrow(address, initialState);
    }

    static createCellOfFundEscrow(body: {
        queryId: uint64
    }) {
        return FundEscrow.toCell(FundEscrow.create(body));
    }

    static createCellOfMarkDelivered(body: {
        queryId: uint64
        evidenceHash: uint256
    }) {
        return MarkDelivered.toCell(MarkDelivered.create(body));
    }

    static createCellOfConfirmDelivery(body: {
        queryId: uint64
    }) {
        return ConfirmDelivery.toCell(ConfirmDelivery.create(body));
    }

    static createCellOfOpenDispute(body: {
        queryId: uint64
        reasonHash: uint256
    }) {
        return OpenDispute.toCell(OpenDispute.create(body));
    }

    static createCellOfRefundExpired(body: {
        queryId: uint64
    }) {
        return RefundExpired.toCell(RefundExpired.create(body));
    }

    static createCellOfReleaseAfterReview(body: {
        queryId: uint64
    }) {
        return ReleaseAfterReview.toCell(ReleaseAfterReview.create(body));
    }

    static createCellOfResolveDispute(body: {
        queryId: uint64
        releaseToSeller: boolean
    }) {
        return ResolveDispute.toCell(ResolveDispute.create(body));
    }

    async sendDeploy(provider: ContractProvider, via: Sender, msgValue: coins, extraOptions?: ExtraSendOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: c.Cell.EMPTY,
            ...extraOptions
        });
    }

    async sendFundEscrow(provider: ContractProvider, via: Sender, msgValue: coins, body: {
        queryId: uint64
    }, extraOptions?: ExtraSendOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: FundEscrow.toCell(FundEscrow.create(body)),
            ...extraOptions
        });
    }

    async sendMarkDelivered(provider: ContractProvider, via: Sender, msgValue: coins, body: {
        queryId: uint64
        evidenceHash: uint256
    }, extraOptions?: ExtraSendOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: MarkDelivered.toCell(MarkDelivered.create(body)),
            ...extraOptions
        });
    }

    async sendConfirmDelivery(provider: ContractProvider, via: Sender, msgValue: coins, body: {
        queryId: uint64
    }, extraOptions?: ExtraSendOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: ConfirmDelivery.toCell(ConfirmDelivery.create(body)),
            ...extraOptions
        });
    }

    async sendOpenDispute(provider: ContractProvider, via: Sender, msgValue: coins, body: {
        queryId: uint64
        reasonHash: uint256
    }, extraOptions?: ExtraSendOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: OpenDispute.toCell(OpenDispute.create(body)),
            ...extraOptions
        });
    }

    async sendRefundExpired(provider: ContractProvider, via: Sender, msgValue: coins, body: {
        queryId: uint64
    }, extraOptions?: ExtraSendOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: RefundExpired.toCell(RefundExpired.create(body)),
            ...extraOptions
        });
    }

    async sendReleaseAfterReview(provider: ContractProvider, via: Sender, msgValue: coins, body: {
        queryId: uint64
    }, extraOptions?: ExtraSendOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: ReleaseAfterReview.toCell(ReleaseAfterReview.create(body)),
            ...extraOptions
        });
    }

    async sendResolveDispute(provider: ContractProvider, via: Sender, msgValue: coins, body: {
        queryId: uint64
        releaseToSeller: boolean
    }, extraOptions?: ExtraSendOptions) {
        return provider.internal(via, {
            value: msgValue,
            body: ResolveDispute.toCell(ResolveDispute.create(body)),
            ...extraOptions
        });
    }

    async getEscrowData(provider: ContractProvider): Promise<EscrowStorage> {
        const r = StackReader.fromGetMethod(10, await provider.get('escrowData', []));
        return ({
            $: 'EscrowStorage',
            dealId: r.readBigInt(),
            buyerSide: r.readCellRef<EscrowBuyerSide>(EscrowBuyerSide.fromSlice),
            sellerSide: r.readCellRef<EscrowSellerSide>(EscrowSellerSide.fromSlice),
            amounts: r.readCellRef<EscrowAmounts>(EscrowAmounts.fromSlice),
            deliveryDeadline: r.readBigInt(),
            reviewWindow: r.readBigInt(),
            reviewDeadline: r.readBigInt(),
            deliveredEvidenceHash: r.readBigInt(),
            disputeReasonHash: r.readBigInt(),
            status: r.readBigInt(),
        });
    }

    async getExpectedFundingValue(provider: ContractProvider): Promise<coins> {
        const r = StackReader.fromGetMethod(1, await provider.get('expectedFundingValue', []));
        return r.readBigInt();
    }
}

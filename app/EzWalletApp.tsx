"use client";

import {
  useTonAddress,
  useTonConnectUI,
  useTonWallet,
} from "@tonconnect/ui-react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BanknoteArrowDown,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Heart,
  Info,
  MapPin,
  MessageCircle,
  PackageCheck,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  UserRound,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateTransactionFees, nanoToTon } from "@/lib/format";

type Tab = "market" | "work" | "wallet" | "profile";
type SheetName =
  | "listing"
  | "create"
  | "apply"
  | "checkout"
  | "payment"
  | "profile"
  | "report"
  | null;

type Listing = {
  id: string;
  section: "market" | "work";
  type: "physical" | "digital" | "service" | "job";
  title: string;
  description: string;
  category: string;
  priceNano: string;
  currency: string;
  imageUrl: string | null;
  location: string;
  delivery: string;
  status: string;
  createdAt: string;
  ownerId: number;
  ownerName: string;
  ownerUsername: string | null;
  ownerPhotoUrl: string | null;
  ownerRatingMilli: number;
  ownerReviewCount: number;
  ownerDealsCompleted: number;
};

type User = {
  id: number;
  telegramId: string;
  username: string | null;
  displayName: string;
  photoUrl: string | null;
  bio: string;
  city: string;
  walletAddress: string | null;
  walletNetwork: "mainnet" | "testnet" | null;
  walletVerifiedAt: string | null;
  ratingMilli: number;
  reviewCount: number;
  dealsCompleted: number;
  updatedAt: string;
};

type Deal = {
  id: string;
  listingId: string;
  title: string;
  imageUrl: string | null;
  grossNano: string;
  buyerFeeNano: string;
  sellerFeeNano: string;
  buyerTotalNano: string;
  platformFeeNano: string;
  sellerAmountNano: string;
  status: string;
  network: "mainnet" | "testnet";
  transactionRef: string | null;
  buyerId: number;
  sellerId: number;
  counterpartyName: string;
  createdAt: string;
};

type ApplicationSummary = {
  id: string;
  listingId: string;
  status: string;
};

type AppConfig = {
  feeBps: number;
  network: "mainnet" | "testnet";
  paymentsReady: boolean;
  telegramReady: boolean;
};

type TelegramWebApp = {
  initData: string;
  initDataUnsafe?: {
    user?: {
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };
  };
  ready(): void;
  expand(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  disableVerticalSwipes?(): void;
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy"): void;
    notificationOccurred(type: "success" | "warning" | "error"): void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const marketCategories = ["All", "Physical", "Digital", "Electronics", "Mobility"];
const workCategories = ["All", "Services", "Jobs", "Remote", "Today"];

function compactAddress(address: string) {
  if (address.length < 14) return address;
  return `${address.slice(0, 7)}…${address.slice(-6)}`;
}

function formatRating(ratingMilli: number) {
  return (ratingMilli / 1000).toFixed(1);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending_wallet: "Waiting for wallet",
    payment_submitted: "Confirming on TON",
    awaiting_delivery: "In progress",
    fulfilled: "Completed",
    cancelled: "Cancelled",
    disputed: "Needs review",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="Easy Wallet">
      <img
        className="brand-mark"
        src="/brand/ezwallet-logo.png"
        alt=""
        aria-hidden="true"
      />
      {!compact && <span>Easy Wallet</span>}
    </div>
  );
}

function Avatar({
  name,
  src,
  size = "medium",
}: {
  name: string;
  src?: string | null;
  size?: "small" | "medium" | "large";
}) {
  return (
    <span className={`avatar avatar-${size}`}>
      {src ? (
        <img src={src} alt="" draggable={false} />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

function BottomNavigation({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (next: Tab) => void;
}) {
  const items: Array<{
    id: Tab;
    label: string;
    icon: typeof Store;
  }> = [
    { id: "market", label: "Market", icon: Store },
    { id: "work", label: "Work", icon: BriefcaseBusiness },
    { id: "wallet", label: "Wallet", icon: WalletCards },
    { id: "profile", label: "Profile", icon: UserRound },
  ];

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={tab === id ? "nav-item is-active" : "nav-item"}
          onClick={() => onChange(id)}
          aria-current={tab === id ? "page" : undefined}
        >
          <span className="nav-icon">
            <Icon size={20} strokeWidth={tab === id ? 2.6 : 2} />
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function AppHeader({
  session,
  connected,
  onCreate,
}: {
  session: User | null;
  connected: boolean;
  onCreate: () => void;
}) {
  return (
    <header className="app-header">
      <Brand />
      <div className="header-actions">
        <span className={connected ? "network-pill is-online" : "network-pill"}>
          <i />
          {connected ? "TON connected" : "TON wallet"}
        </span>
        <button
          type="button"
          className="header-avatar"
          onClick={onCreate}
          aria-label="Create a listing"
        >
          {session ? (
            <Avatar name={session.displayName} src={session.photoUrl} size="small" />
          ) : (
            <Plus size={17} />
          )}
        </button>
      </div>
    </header>
  );
}

function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: string;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {action && (
        <button type="button">
          {action} <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

function ListingCard({
  listing,
  onOpen,
  wide = false,
}: {
  listing: Listing;
  onOpen: (listing: Listing) => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      className={wide ? "listing-card listing-card-wide" : "listing-card"}
      onClick={() => onOpen(listing)}
    >
      <span
        className={
          listing.imageUrl ? "listing-media" : "listing-media listing-media-empty"
        }
      >
        {listing.imageUrl ? (
          <img src={listing.imageUrl} alt="" draggable={false} />
        ) : (
          <BriefcaseBusiness size={30} />
        )}
        <span className="listing-type">{listing.type}</span>
        <span className="save-button" aria-hidden="true">
          <Heart size={15} />
        </span>
      </span>
      <span className="listing-copy">
        <span className="listing-category">{listing.category}</span>
        <strong>{listing.title}</strong>
        <span className="listing-meta">
          <Star size={12} fill="currentColor" />{" "}
          {formatRating(listing.ownerRatingMilli)}
          <i>·</i>
          {listing.location}
        </span>
        <span className="listing-footer">
          <b>{nanoToTon(listing.priceNano)} TON</b>
          <span>{listing.type === "job" ? "budget" : listing.delivery}</span>
        </span>
      </span>
    </button>
  );
}

function CategoryRail({
  categories,
  selected,
  onSelect,
}: {
  categories: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="category-rail" aria-label="Filters">
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          className={selected === category ? "chip is-selected" : "chip"}
          onClick={() => onSelect(category)}
        >
          {category}
        </button>
      ))}
    </div>
  );
}

function SearchField({
  query,
  onChange,
  placeholder,
}: {
  query: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search-field">
      <Search size={18} />
      <input
        value={query}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <button type="button" aria-label="Search filters">
        <Settings2 size={17} />
      </button>
    </label>
  );
}

function MarketScreen({
  listings,
  query,
  setQuery,
  category,
  setCategory,
  onOpen,
}: {
  listings: Listing[];
  query: string;
  setQuery: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  onOpen: (listing: Listing) => void;
}) {
  return (
    <main className="screen market-screen">
      <section className="hero">
        <span className="eyebrow">
          <ShieldCheck size={14} /> People-powered marketplace
        </span>
        <h1>
          Find good things.
          <br />
          <span>Trade your way.</span>
        </h1>
        <p>
          Physical and digital goods from real people — paid directly from your
          own wallet.
        </p>
        <SearchField
          query={query}
          onChange={setQuery}
          placeholder="Search the market"
        />
      </section>

      <CategoryRail
        categories={marketCategories}
        selected={category}
        onSelect={setCategory}
      />

      <section className="content-section">
        <SectionHeading
          title="Fresh nearby"
          action={`${listings.length} ${listings.length === 1 ? "listing" : "listings"}`}
        />
        <div className="listing-grid">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} onOpen={onOpen} />
          ))}
        </div>
        {!listings.length && (
          <div className="empty-state">
            <Search size={24} />
            <strong>No matches yet</strong>
            <p>Try another keyword or category.</p>
          </div>
        )}
      </section>

      <section className="trust-banner">
        <div className="trust-icon">
          <ShieldCheck size={22} />
        </div>
        <div>
          <strong>Your keys never enter Easy Wallet.</strong>
          <p>
            You review and approve every TON transfer inside your connected
            wallet.
          </p>
        </div>
        <ChevronRight size={18} />
      </section>
    </main>
  );
}

function WorkScreen({
  listings,
  query,
  setQuery,
  category,
  setCategory,
  onOpen,
  onCreate,
}: {
  listings: Listing[];
  query: string;
  setQuery: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  onOpen: (listing: Listing) => void;
  onCreate: () => void;
}) {
  return (
    <main className="screen work-screen">
      <section className="work-hero">
        <div>
          <span className="eyebrow">
            <Zap size={14} /> Work, without the runaround
          </span>
          <h1>
            Skills meet
            <br />
            <span>real needs.</span>
          </h1>
        </div>
        <div className="work-stat">
          <b>{listings.length}</b>
          <span>open now</span>
          <i />
        </div>
      </section>

      <SearchField
        query={query}
        onChange={setQuery}
        placeholder="Search jobs and services"
      />
      <CategoryRail
        categories={workCategories}
        selected={category}
        onSelect={setCategory}
      />

      <section className="work-cta">
        <div>
          <span>Need something done?</span>
          <strong>Post a clear brief in two minutes.</strong>
        </div>
        <button type="button" onClick={onCreate}>
          Post work <Plus size={16} />
        </button>
      </section>

      <section className="content-section work-list-section">
        <SectionHeading title="Recommended for you" />
        <div className="work-list">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onOpen={onOpen}
              wide
            />
          ))}
        </div>
        {!listings.length && (
          <div className="empty-state">
            <BriefcaseBusiness size={24} />
            <strong>No work matches</strong>
            <p>Try clearing a filter.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function WalletScreen({
  walletAddress,
  walletConnected,
  deals,
  network,
  walletVerified,
  currentUserId,
  onConnect,
  onDisconnect,
  onDealAction,
}: {
  walletAddress: string;
  walletConnected: boolean;
  deals: Deal[];
  network: "mainnet" | "testnet";
  walletVerified: boolean;
  currentUserId?: number;
  onConnect: () => void;
  onDisconnect: () => void;
  onDealAction: (
    deal: Deal,
    action: "cancel" | "mark_delivered" | "confirm_received" | "dispute"
  ) => void;
}) {
  const submitted = deals.filter(
    (deal) => deal.status === "payment_submitted"
  ).length;
  const completed = deals.filter(
    (deal) => deal.status === "fulfilled"
  ).length;

  return (
    <main className="screen wallet-screen">
      <section className="wallet-hero">
        <div className="wallet-hero-top">
          <span className="eyebrow">
            <WalletCards size={14} /> Non-custodial wallet
          </span>
          <span className="network-badge">{network}</span>
        </div>
        <h1>{walletConnected ? "Wallet ready." : "Your wallet stays yours."}</h1>
        <p>
          Easy Wallet never stores a seed phrase, private key or spendable balance.
        </p>
        {walletConnected ? (
          <div className="connected-wallet">
            <ShieldCheck
              className={walletVerified ? "wallet-proof-icon is-verified" : "wallet-proof-icon"}
              size={26}
            />
            <div>
              <small>
                {walletVerified
                  ? "Address verified with TON proof"
                  : "Connected · verification required"}
              </small>
              <strong>{compactAddress(walletAddress)}</strong>
            </div>
            <button type="button" onClick={onDisconnect}>
              Disconnect
            </button>
          </div>
        ) : (
          <button className="primary-action wallet-connect" onClick={onConnect}>
            Connect TON Wallet <ArrowRight size={18} />
          </button>
        )}
      </section>

      <section className="wallet-stats">
        <div>
          <span>Marketplace deals</span>
          <b>{deals.length}</b>
        </div>
        <div>
          <span>Confirming</span>
          <b>{submitted}</b>
        </div>
        <div>
          <span>Completed</span>
          <b>{completed}</b>
        </div>
      </section>

      <section className="content-section">
        <SectionHeading title="Deal activity" action={deals.length ? "Ledger" : undefined} />
        <div className="deal-list">
          {deals.map((deal) => (
            <article className="deal-record" key={deal.id}>
              <div className="deal-row">
                <span className={`deal-icon deal-${deal.status}`}>
                  {deal.status === "fulfilled" ? (
                    <Check size={17} />
                  ) : (
                    <Clock3 size={17} />
                  )}
                </span>
                <div>
                  <strong>{deal.title}</strong>
                  <small>
                    {statusLabel(deal.status)} · {deal.counterpartyName}
                  </small>
                </div>
                <b>{nanoToTon(deal.grossNano)} TON</b>
              </div>
              {deal.status === "pending_wallet" &&
                deal.buyerId === currentUserId && (
                  <button
                    type="button"
                    className="deal-action"
                    onClick={() => onDealAction(deal, "cancel")}
                  >
                    Cancel unpaid deal
                  </button>
                )}
              {deal.status === "awaiting_delivery" && (
                <div className="deal-actions">
                  {deal.sellerId === currentUserId && (
                    <button
                      type="button"
                      onClick={() => onDealAction(deal, "mark_delivered")}
                    >
                      Mark delivered
                    </button>
                  )}
                  {deal.buyerId === currentUserId && (
                    <button
                      type="button"
                      className="is-primary"
                      onClick={() => onDealAction(deal, "confirm_received")}
                    >
                      Confirm received
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDealAction(deal, "dispute")}
                  >
                    Report a problem
                  </button>
                </div>
              )}
            </article>
          ))}
          {!deals.length && (
            <div className="empty-state compact">
              <BanknoteArrowDown size={24} />
              <strong>No deal activity yet</strong>
              <p>Your marketplace records will appear here.</p>
            </div>
          )}
        </div>
      </section>

      <section className="ledger-note">
        <Info size={17} />
        <p>
          The Easy Wallet ledger records deal intent and wallet submissions. TON
          remains the source of truth for final settlement.
        </p>
      </section>
    </main>
  );
}

function ProfileScreen({
  user,
  listingCount,
  connected,
  onCreate,
  onEdit,
  onSafety,
}: {
  user: User | null;
  listingCount: number;
  connected: boolean;
  onCreate: () => void;
  onEdit: () => void;
  onSafety: () => void;
}) {
  const name = user?.displayName ?? "Telegram guest";
  return (
    <main className="screen profile-screen">
      <section className="profile-hero">
        <div className="profile-topline">
          <span className="eyebrow">Profile & reputation</span>
          <button type="button" aria-label="Profile settings" onClick={onEdit}>
            <Settings2 size={19} />
          </button>
        </div>
        <div className="profile-person">
          <Avatar name={name} src={user?.photoUrl} size="large" />
          <div>
            <h1>{name}</h1>
            <p>
              {user ? (
                <>
                  <BadgeCheck size={15} /> Telegram verified
                </>
              ) : (
                <>Open inside Telegram to verify your profile</>
              )}
            </p>
          </div>
        </div>
        <div className="profile-location">
          <MapPin size={15} /> {user?.city ?? "Riga"}{" "}
          <i />
          {connected ? "TON wallet linked" : "Wallet not linked"}
        </div>
      </section>

      <section className="reputation-card">
        <div className="reputation-score">
          <span>Trust score</span>
          <strong>{user ? formatRating(user.ratingMilli) : "—"}</strong>
          <p>
            <Star size={14} fill="currentColor" /> Based on{" "}
            {user?.reviewCount ?? 0} reviews
          </p>
        </div>
        <div className="reputation-stats">
          <div>
            <b>{user?.dealsCompleted ?? 0}</b>
            <span>deals</span>
          </div>
          <div>
            <b>{listingCount}</b>
            <span>listings</span>
          </div>
          <div>
            <b>100%</b>
            <span>response</span>
          </div>
        </div>
      </section>

      <section className="badge-section">
        <SectionHeading title="Earned trust" />
        <div className="badge-grid">
          <div>
            <span>
              <BadgeCheck size={19} />
            </span>
            <strong>Telegram ID</strong>
            <small>Identity signal</small>
          </div>
          <div>
            <span>
              <PackageCheck size={19} />
            </span>
            <strong>Reliable trader</strong>
            <small>Completed deals</small>
          </div>
          <div>
            <span>
              <MessageCircle size={19} />
            </span>
            <strong>Fast replies</strong>
            <small>Under 1 hour</small>
          </div>
        </div>
      </section>

      <section className="profile-menu">
        <button type="button" onClick={onCreate}>
          <span>
            <Store size={18} /> My listings
          </span>
          <strong>{listingCount}</strong>
          <ChevronRight size={17} />
        </button>
        <button type="button" onClick={onSafety}>
          <span>
            <ShieldCheck size={18} /> Safety & disputes
          </span>
          <ChevronRight size={17} />
        </button>
        <button type="button" onClick={onSafety}>
          <span>
            <CircleHelp size={18} /> Help centre
          </span>
          <ChevronRight size={17} />
        </button>
      </section>
    </main>
  );
}

function BottomSheet({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        {title && (
          <div className="sheet-header">
            <h2>{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </section>
    </div>
  );
}

function ListingSheet({
  listing,
  currentUser,
  hasApplied,
  onClose,
  onPay,
  onApply,
  onReport,
  busy,
}: {
  listing: Listing;
  currentUser: User | null;
  hasApplied: boolean;
  onClose: () => void;
  onPay: (listing: Listing) => void;
  onApply: (listing: Listing) => void;
  onReport: (listing: Listing) => void;
  busy: boolean;
}) {
  const isOwner = currentUser?.id === listing.ownerId;
  const isJob = listing.type === "job";
  return (
    <div className="listing-detail">
      <div
        className={
          listing.imageUrl
            ? "detail-media"
            : "detail-media detail-media-empty"
        }
      >
        {listing.imageUrl ? (
          <img src={listing.imageUrl} alt="" draggable={false} />
        ) : (
          <BriefcaseBusiness size={38} />
        )}
        <button type="button" onClick={onClose} aria-label="Close listing">
          <ArrowLeft size={19} />
        </button>
        <button type="button" aria-label="Save listing">
          <Heart size={18} />
        </button>
      </div>
      <div className="detail-body">
        <span className="detail-category">
          {listing.category} · {listing.type}
        </span>
        <h2>{listing.title}</h2>
        <div className="detail-price">
          <strong>{nanoToTon(listing.priceNano)} TON</strong>
          <span>{isJob ? "project budget" : listing.delivery}</span>
        </div>

        <div className="seller-row">
          <Avatar
            name={listing.ownerName}
            src={listing.ownerPhotoUrl}
            size="medium"
          />
          <div>
            <strong>
              {listing.ownerName} <BadgeCheck size={14} />
            </strong>
            <span>
              <Star size={12} fill="currentColor" />{" "}
              {formatRating(listing.ownerRatingMilli)} ·{" "}
              {listing.ownerDealsCompleted} completed
            </span>
          </div>
          <button type="button">
            <MessageCircle size={17} />
          </button>
        </div>

        <p className="detail-description">{listing.description}</p>
        <div className="detail-facts">
          <div>
            <MapPin size={16} />
            <span>
              <small>Location</small>
              <strong>{listing.location}</strong>
            </span>
          </div>
          <div>
            <Clock3 size={16} />
            <span>
              <small>Handover</small>
              <strong>{listing.delivery}</strong>
            </span>
          </div>
        </div>

        {!isOwner && (
          <button
            type="button"
            className="text-action"
            onClick={() => onReport(listing)}
          >
            Report this listing
          </button>
        )}

        <button
          type="button"
          className="primary-action"
          disabled={busy || isOwner || (isJob && hasApplied)}
          onClick={() => (isJob ? onApply(listing) : onPay(listing))}
        >
          {isOwner
            ? "This is your listing"
            : isJob && hasApplied
              ? "Application sent"
            : busy
              ? "Preparing…"
              : isJob
                ? "Apply for this work"
                : `Continue · ${nanoToTon(listing.priceNano)} TON`}
          {!busy && !isOwner && <ArrowRight size={18} />}
        </button>
      </div>
    </div>
  );
}

type CreateForm = {
  section: "market" | "work";
  type: "physical" | "digital" | "service" | "job";
  title: string;
  description: string;
  category: string;
  priceTon: string;
  location: string;
  delivery: string;
};

const initialCreateForm: CreateForm = {
  section: "market",
  type: "physical",
  title: "",
  description: "",
  category: "Other",
  priceTon: "",
  location: "Riga",
  delivery: "Arrange in chat",
};

function CreateSheet({
  open,
  onClose,
  onSubmit,
  busy,
  canPublish,
  initialSection,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (form: CreateForm, image: File | null) => Promise<void>;
  busy: boolean;
  canPublish: boolean;
  initialSection: "market" | "work";
}) {
  const [form, setForm] = useState<CreateForm>(() => ({
    ...initialCreateForm,
    section: initialSection,
    type: initialSection === "market" ? "physical" : "service",
  }));
  const [image, setImage] = useState<File | null>(null);
  const setSection = (section: "market" | "work") => {
    setForm((current) => ({
      ...current,
      section,
      type: section === "market" ? "physical" : "service",
    }));
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Create a listing">
      <form
        className="create-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(form, image);
        }}
      >
        <div className="segmented-control">
          <button
            type="button"
            className={form.section === "market" ? "is-active" : ""}
            onClick={() => setSection("market")}
          >
            <ShoppingBag size={16} /> Market
          </button>
          <button
            type="button"
            className={form.section === "work" ? "is-active" : ""}
            onClick={() => setSection("work")}
          >
            <BriefcaseBusiness size={16} /> Work
          </button>
        </div>

        <label>
          <span>Listing type</span>
          <select
            value={form.type}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                type: event.target.value as CreateForm["type"],
              }))
            }
          >
            {form.section === "market" ? (
              <>
                <option value="physical">Physical item</option>
                <option value="digital">Digital product</option>
              </>
            ) : (
              <>
                <option value="service">Offer a service</option>
                <option value="job">Post a job</option>
              </>
            )}
          </select>
        </label>

        <label>
          <span>Title</span>
          <input
            required
            minLength={5}
            maxLength={90}
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Make it specific"
          />
        </label>

        <label>
          <span>Description</span>
          <textarea
            required
            minLength={20}
            maxLength={800}
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="What should the other person know?"
          />
          <small>{form.description.length}/800</small>
        </label>

        <label className="file-field">
          <span>Listing image</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setImage(event.target.files?.[0] ?? null)}
          />
          <small>
            {image ? image.name : "JPG, PNG, or WebP · up to 5 MB"}
          </small>
        </label>

        <div className="form-grid">
          <label>
            <span>Price or budget</span>
            <div className="ton-input">
              <input
                required
                inputMode="decimal"
                value={form.priceTon}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priceTon: event.target.value.replace(/[^0-9.]/g, ""),
                  }))
                }
                placeholder="0.00"
              />
              <b>TON</b>
            </div>
          </label>
          <label>
            <span>Category</span>
            <input
              required
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
            />
          </label>
        </div>

        <label>
          <span>Location</span>
          <input
            required
            value={form.location}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                location: event.target.value,
              }))
            }
          />
        </label>
        <label>
          <span>Delivery or timing</span>
          <input
            required
            value={form.delivery}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                delivery: event.target.value,
              }))
            }
          />
        </label>

        {!canPublish && (
          <div className="form-notice">
            <Info size={17} />
            Open Easy Wallet from Telegram to publish under a verified profile.
          </div>
        )}

        <button
          type="submit"
          className="primary-action"
          disabled={busy || !canPublish}
        >
          {busy ? "Publishing…" : "Publish listing"} <ArrowRight size={18} />
        </button>
      </form>
    </BottomSheet>
  );
}

function ApplySheet({
  open,
  listing,
  onClose,
  onSubmit,
  busy,
}: {
  open: boolean;
  listing: Listing | null;
  onClose: () => void;
  onSubmit: (offerTon: string, message: string) => Promise<void>;
  busy: boolean;
}) {
  const [offerTon, setOfferTon] = useState(() =>
    listing ? nanoToTon(listing.priceNano, 4) : ""
  );
  const [message, setMessage] = useState("");

  return (
    <BottomSheet open={open && Boolean(listing)} onClose={onClose} title="Send an application">
      <form
        className="create-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(offerTon, message);
        }}
      >
        <div className="application-summary">
          <BriefcaseBusiness size={20} />
          <div>
            <small>Applying for</small>
            <strong>{listing?.title}</strong>
          </div>
        </div>
        <label>
          <span>Your offer</span>
          <div className="ton-input">
            <input
              required
              inputMode="decimal"
              value={offerTon}
              onChange={(event) =>
                setOfferTon(event.target.value.replace(/[^0-9.]/g, ""))
              }
            />
            <b>TON</b>
          </div>
        </label>
        <label>
          <span>Message</span>
          <textarea
            required
            minLength={10}
            maxLength={500}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Share the experience and timing that make you a good fit."
          />
        </label>
        <button className="primary-action" disabled={busy}>
          {busy ? "Sending…" : "Send application"} <ArrowRight size={18} />
        </button>
      </form>
    </BottomSheet>
  );
}

function PaymentSuccessSheet({
  open,
  deal,
  onClose,
}: {
  open: boolean;
  deal: {
    title: string;
    grossNano: string;
    buyerFeeNano: string;
    sellerFeeNano: string;
    buyerTotalNano: string;
    platformFeeNano: string;
    sellerAmountNano: string;
  } | null;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open && Boolean(deal)} onClose={onClose}>
      <div className="payment-success">
        <span className="success-orb">
          <Check size={28} />
        </span>
        <span className="eyebrow">Wallet submission recorded</span>
        <h2>{deal?.title}</h2>
        <p>
          Your wallet broadcast the transaction. Easy Wallet will keep the deal in
          confirming status until recipient transfers are observed on TON.
        </p>
        <div className="payment-breakdown">
          <div>
            <span>Seller</span>
            <b>{deal && nanoToTon(deal.sellerAmountNano, 4)} TON</b>
          </div>
          <div>
            <span>Your fee · 1%</span>
            <b>{deal && nanoToTon(deal.buyerFeeNano, 4)} TON</b>
          </div>
          <div>
            <span>Seller fee · 1%</span>
            <b>{deal && nanoToTon(deal.sellerFeeNano, 4)} TON</b>
          </div>
          <div>
            <span>Total approved</span>
            <b>{deal && nanoToTon(deal.buyerTotalNano, 4)} TON</b>
          </div>
        </div>
        <button type="button" className="primary-action" onClick={onClose}>
          View wallet activity <ArrowRight size={18} />
        </button>
      </div>
    </BottomSheet>
  );
}

function PaymentQuoteSheet({
  open,
  listing,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  listing: Listing | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (listing: Listing) => Promise<void>;
}) {
  if (!listing) return null;
  const quote = calculateTransactionFees(BigInt(listing.priceNano));

  return (
    <BottomSheet open={open} onClose={onClose} title="Review payment">
      <div className="payment-success">
        <span className="eyebrow">Transparent checkout</span>
        <h2>{listing.title}</h2>
        <p>
          Both parties contribute 1% only when this transaction is approved.
          Easy Wallet never takes custody of your funds.
        </p>
        <div className="payment-breakdown">
          <div>
            <span>Item or service price</span>
            <b>{nanoToTon(quote.baseNano.toString(), 4)} TON</b>
          </div>
          <div>
            <span>Your fee · 1%</span>
            <b>{nanoToTon(quote.buyerFeeNano.toString(), 4)} TON</b>
          </div>
          <div>
            <span>You approve</span>
            <b>{nanoToTon(quote.buyerTotalNano.toString(), 4)} TON</b>
          </div>
          <div>
            <span>Seller fee · 1%</span>
            <b>{nanoToTon(quote.sellerFeeNano.toString(), 4)} TON</b>
          </div>
          <div>
            <span>Seller receives</span>
            <b>{nanoToTon(quote.sellerAmountNano.toString(), 4)} TON</b>
          </div>
        </div>
        <button
          type="button"
          className="primary-action"
          disabled={busy}
          onClick={() => void onConfirm(listing)}
        >
          {busy
            ? "Preparing wallet…"
            : `Approve ${nanoToTon(quote.buyerTotalNano.toString(), 4)} TON`}
          {!busy && <ArrowRight size={18} />}
        </button>
        <button type="button" className="text-action" onClick={onClose}>
          Back to listing
        </button>
      </div>
    </BottomSheet>
  );
}

function ProfileEditSheet({
  open,
  user,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  user: User;
  busy: boolean;
  onClose: () => void;
  onSubmit: (profile: {
    displayName: string;
    bio: string;
    city: string;
  }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio);
  const [city, setCity] = useState(user.city);
  return (
    <BottomSheet open={open} onClose={onClose} title="Edit profile">
      <form
        className="create-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({ displayName, bio, city });
        }}
      >
        <label>
          <span>Display name</span>
          <input
            required
            maxLength={80}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <label>
          <span>City</span>
          <input
            required
            maxLength={80}
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
        </label>
        <label>
          <span>Bio</span>
          <textarea
            maxLength={320}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="What should people know about you?"
          />
          <small>{bio.length}/320</small>
        </label>
        <button className="primary-action" disabled={busy}>
          {busy ? "Saving…" : "Save profile"} <ArrowRight size={18} />
        </button>
      </form>
    </BottomSheet>
  );
}

function ReportSheet({
  open,
  listing,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  listing: Listing | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string, detail: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("fraud");
  const [detail, setDetail] = useState("");
  return (
    <BottomSheet open={open && Boolean(listing)} onClose={onClose} title="Report listing">
      <form
        className="create-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(reason, detail);
        }}
      >
        <div className="form-notice">
          <ShieldCheck size={17} />
          Reports go to the moderation queue. Use the deal dispute action for
          an active payment or delivery problem.
        </div>
        <label>
          <span>Reason</span>
          <select value={reason} onChange={(event) => setReason(event.target.value)}>
            <option value="fraud">Suspected fraud</option>
            <option value="prohibited_item">Prohibited item</option>
            <option value="harassment">Harassment</option>
            <option value="identity">Identity concern</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          <span>What happened?</span>
          <textarea
            required
            minLength={10}
            maxLength={1000}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
          />
        </label>
        <button className="primary-action" disabled={busy}>
          {busy ? "Sending…" : "Send report"} <ArrowRight size={18} />
        </button>
      </form>
    </BottomSheet>
  );
}

function Toast({
  message,
  tone,
}: {
  message: string;
  tone: "success" | "error" | "neutral";
}) {
  return (
    <div className={`toast toast-${tone}`} role="status">
      {tone === "success" ? (
        <Check size={16} />
      ) : tone === "error" ? (
        <Info size={16} />
      ) : (
        <Sparkles size={16} />
      )}
      {message}
    </div>
  );
}

export default function EzWalletApp() {
  const [tab, setTab] = useState<Tab>("market");
  const [sheet, setSheet] = useState<SheetName>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [config, setConfig] = useState<AppConfig>({
    feeBps: 100,
    network: "testnet",
    paymentsReady: false,
    telegramReady: false,
  });
  const [session, setSession] = useState<User | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [query, setQuery] = useState("");
  const [marketCategory, setMarketCategory] = useState("All");
  const [workCategory, setWorkCategory] = useState("All");
  const [createSection, setCreateSection] = useState<"market" | "work">("market");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "error" | "neutral";
  } | null>(null);
  const [paymentDeal, setPaymentDeal] = useState<{
    title: string;
    grossNano: string;
    buyerFeeNano: string;
    sellerFeeNano: string;
    buyerTotalNano: string;
    platformFeeNano: string;
    sellerAmountNano: string;
  } | null>(null);
  const [walletProofStatus, setWalletProofStatus] = useState<
    "idle" | "ready" | "verifying" | "verified" | "reconnect" | "error"
  >("idle");
  const proofAttempt = useRef("");
  const wallet = useTonWallet();
  const walletAddress = useTonAddress(true);
  const [tonConnectUi] = useTonConnectUI();
  const walletVerified =
    walletProofStatus === "verified" ||
    Boolean(
      walletAddress &&
        session?.walletAddress === walletAddress &&
        session.walletVerifiedAt
    );

  const isLocalPreview =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "terminal.local"].includes(
      window.location.hostname
    );

  const telegramWebApp =
    typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  const initData = telegramWebApp?.initData ?? "";
  const telegram = initData ? telegramWebApp : undefined;

  const apiFetch = useCallback(
    (path: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers);
      if (initData) headers.set("x-telegram-init-data", initData);
      if (!initData && isLocalPreview) {
        headers.set("x-ezwallet-demo", "local-preview");
      }
      if (options.body && !(options.body instanceof FormData)) {
        headers.set("content-type", "application/json");
      }
      return fetch(path, { ...options, headers });
    },
    [initData, isLocalPreview]
  );

  const showToast = useCallback(
    (message: string, tone: "success" | "error" | "neutral" = "neutral") => {
      setToast({ message, tone });
      window.setTimeout(() => setToast(null), 3400);
    },
    []
  );

  const loadBootstrap = useCallback(async () => {
    const response = await fetch("/api/bootstrap", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load the marketplace.");
    const data = (await response.json()) as {
      listings: Listing[];
      config: AppConfig;
    };
    setListings(data.listings);
    setConfig(data.config);
  }, []);

  const loadSession = useCallback(async () => {
    if (!initData && !isLocalPreview) return;
    const response = await apiFetch("/api/session", { method: "POST" });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? "Telegram session could not be verified.");
    }
    const data = (await response.json()) as { user: User; deals: Deal[] };
    setSession(data.user);
    setDeals(data.deals);

    const applicationsResponse = await apiFetch("/api/applications", {
      cache: "no-store",
    });
    if (applicationsResponse.ok) {
      const applicationsData = (await applicationsResponse.json()) as {
        applications: ApplicationSummary[];
      };
      setApplications(applicationsData.applications);
    }
  }, [apiFetch, initData, isLocalPreview]);

  useEffect(() => {
    telegram?.ready();
    telegram?.expand();
    telegram?.setHeaderColor?.("#ffffff");
    telegram?.setBackgroundColor?.("#ffffff");
    telegram?.disableVerticalSwipes?.();
  }, [telegram]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([loadBootstrap(), loadSession()]).catch((error) => {
        showToast(
          error instanceof Error ? error.message : "Easy Wallet could not start.",
          "error"
        );
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBootstrap, loadSession, showToast]);

  useEffect(() => {
    if (!session) return;
    if (
      walletAddress &&
      session.walletAddress === walletAddress &&
      session.walletVerifiedAt
    ) {
      return;
    }

    let cancelled = false;
    if (!wallet) {
      tonConnectUi.setConnectionNetwork(
        config.network === "mainnet" ? "-239" : "-3"
      );
    }
    tonConnectUi.setConnectRequestParameters({ state: "loading" });
    void apiFetch("/api/wallet/challenge", { method: "POST" })
      .then(async (response) => {
        const data = (await response.json()) as {
          challenge?: string;
          error?: string;
        };
        if (!response.ok || !data.challenge) {
          throw new Error(data.error ?? "Wallet verification could not start.");
        }
        if (cancelled) return;
        tonConnectUi.setConnectRequestParameters({
          state: "ready",
          value: { tonProof: data.challenge },
        });
        setWalletProofStatus(wallet ? "reconnect" : "ready");
      })
      .catch((error) => {
        if (cancelled) return;
        tonConnectUi.setConnectRequestParameters(null);
        setWalletProofStatus("error");
        showToast(
          error instanceof Error
            ? error.message
            : "Wallet verification could not start.",
          "error"
        );
      });
    return () => {
      cancelled = true;
    };
  }, [
    apiFetch,
    config.network,
    session,
    showToast,
    tonConnectUi,
    wallet,
    walletAddress,
  ]);

  useEffect(() => {
    const tonProof = wallet?.connectItems?.tonProof;
    if (!wallet || !tonProof || !("proof" in tonProof)) return;
    const attempt = `${wallet.account.address}:${tonProof.proof.timestamp}`;
    if (proofAttempt.current === attempt) return;
    proofAttempt.current = attempt;
    setWalletProofStatus("verifying");
    void apiFetch("/api/wallet/verify", {
      method: "POST",
      body: JSON.stringify({
        address: wallet.account.address,
        network: wallet.account.chain,
        publicKey: wallet.account.publicKey,
        walletStateInit: wallet.account.walletStateInit,
        proof: tonProof.proof,
      }),
    })
      .then(async (response) => {
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Wallet proof failed.");
        }
        setWalletProofStatus("verified");
        await loadSession();
        telegram?.HapticFeedback?.notificationOccurred("success");
        showToast("TON wallet verified.", "success");
      })
      .catch((error) => {
        setWalletProofStatus("error");
        showToast(
          error instanceof Error ? error.message : "Wallet proof failed.",
          "error"
        );
      });
  }, [apiFetch, loadSession, showToast, telegram, wallet]);

  const filteredMarket = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return listings.filter((listing) => {
      if (listing.section !== "market") return false;
      const queryMatches =
        !normalized ||
        `${listing.title} ${listing.description} ${listing.category}`
          .toLowerCase()
          .includes(normalized);
      const categoryMatches =
        marketCategory === "All" ||
        listing.type.toLowerCase() === marketCategory.toLowerCase() ||
        listing.category.toLowerCase() === marketCategory.toLowerCase();
      return queryMatches && categoryMatches;
    });
  }, [listings, marketCategory, query]);

  const filteredWork = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return listings.filter((listing) => {
      if (listing.section !== "work") return false;
      const queryMatches =
        !normalized ||
        `${listing.title} ${listing.description} ${listing.category}`
          .toLowerCase()
          .includes(normalized);
      const categoryMatches =
        workCategory === "All" ||
        (workCategory === "Services" && listing.type === "service") ||
        (workCategory === "Jobs" && listing.type === "job") ||
        (workCategory === "Remote" && listing.location.includes("Remote")) ||
        (workCategory === "Today" && listing.delivery.toLowerCase().includes("today"));
      return queryMatches && categoryMatches;
    });
  }, [listings, query, workCategory]);

  const openListing = (listing: Listing) => {
    telegram?.HapticFeedback?.impactOccurred("light");
    setSelectedListing(listing);
    setSheet("listing");
  };

  const openCreate = (section: "market" | "work" = tab === "work" ? "work" : "market") => {
    telegram?.HapticFeedback?.impactOccurred("light");
    setCreateSection(section);
    setSheet("create");
  };

  const publishListing = async (form: CreateForm, image: File | null) => {
    setBusy(true);
    try {
      let mediaKey: string | undefined;
      if (image) {
        const mediaForm = new FormData();
        mediaForm.set("file", image);
        const mediaResponse = await apiFetch("/api/media", {
          method: "POST",
          body: mediaForm,
        });
        const mediaData = (await mediaResponse.json()) as {
          key?: string;
          error?: string;
        };
        if (!mediaResponse.ok || !mediaData.key) {
          throw new Error(mediaData.error ?? "Image could not be uploaded.");
        }
        mediaKey = mediaData.key;
      }
      const response = await apiFetch("/api/listings", {
        method: "POST",
        body: JSON.stringify({ ...form, mediaKey }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Listing could not be published.");
      await loadBootstrap();
      setSheet(null);
      setTab(form.section);
      telegram?.HapticFeedback?.notificationOccurred("success");
      showToast("Your listing is live.", "success");
    } catch (error) {
      telegram?.HapticFeedback?.notificationOccurred("error");
      showToast(
        error instanceof Error ? error.message : "Listing could not be published.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const startPayment = async (listing: Listing) => {
    if (!session) {
      showToast("Open Easy Wallet from Telegram to start a verified deal.", "error");
      return;
    }
    if (!wallet || !walletAddress) {
      setSheet(null);
      await tonConnectUi.openModal();
      showToast("Connect a TON wallet, then continue the deal.");
      return;
    }
    if (!walletVerified) {
      showToast(
        walletProofStatus === "reconnect"
          ? "Reconnect your TON wallet to complete address verification."
          : "Finish TON wallet verification before paying.",
        "error"
      );
      return;
    }
    if (!config.paymentsReady) {
      showToast("Payments are waiting for the platform fee wallet.", "error");
      return;
    }

    setSelectedListing(listing);
    setSheet("checkout");
  };

  const confirmPayment = async (listing: Listing) => {
    setBusy(true);
    try {
      const dealResponse = await apiFetch("/api/deals", {
        method: "POST",
        body: JSON.stringify({ listingId: listing.id }),
      });
      const dealData = (await dealResponse.json()) as {
        error?: string;
        deal?: {
          id: string;
          title: string;
          grossNano: string;
          buyerFeeNano: string;
          sellerFeeNano: string;
          buyerTotalNano: string;
          platformFeeNano: string;
          sellerAmountNano: string;
        };
        transaction?: Parameters<typeof tonConnectUi.sendTransaction>[0];
      };
      if (!dealResponse.ok || !dealData.deal || !dealData.transaction) {
        throw new Error(dealData.error ?? "Deal could not be prepared.");
      }

      telegram?.HapticFeedback?.impactOccurred("medium");
      const result = await tonConnectUi.sendTransaction(dealData.transaction);
      const submittedResponse = await apiFetch(
        `/api/deals/${dealData.deal.id}/submitted`,
        {
          method: "POST",
          body: JSON.stringify({ boc: result.boc, traceId: result.traceId }),
        }
      );
      if (!submittedResponse.ok) {
        const submitted = (await submittedResponse.json()) as { error?: string };
        throw new Error(
          submitted.error ??
            "Wallet sent the transaction, but the ledger record needs attention."
        );
      }

      setPaymentDeal(dealData.deal);
      setSheet("payment");
      await loadSession();
      telegram?.HapticFeedback?.notificationOccurred("success");
    } catch (error) {
      telegram?.HapticFeedback?.notificationOccurred("error");
      showToast(
        error instanceof Error ? error.message : "Payment was not completed.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const openApply = (listing: Listing) => {
    if (!session) {
      showToast("Open Easy Wallet from Telegram to apply.", "error");
      return;
    }
    setSelectedListing(listing);
    setSheet("apply");
  };

  const submitApplication = async (offerTon: string, message: string) => {
    if (!selectedListing) return;
    setBusy(true);
    try {
      const response = await apiFetch("/api/applications", {
        method: "POST",
        body: JSON.stringify({
          listingId: selectedListing.id,
          offerTon,
          message,
        }),
      });
      const data = (await response.json()) as {
        application?: ApplicationSummary;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Application could not be sent.");
      if (data.application) {
        setApplications((current) => [data.application!, ...current]);
      }
      setSheet(null);
      telegram?.HapticFeedback?.notificationOccurred("success");
      showToast("Application sent to the job owner.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Application could not be sent.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const updateProfile = async (profile: {
    displayName: string;
    bio: string;
    city: string;
  }) => {
    setBusy(true);
    try {
      const response = await apiFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify(profile),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Profile could not be saved.");
      await loadSession();
      setSheet(null);
      showToast("Profile updated.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Profile could not be saved.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const submitReport = async (reason: string, detail: string) => {
    if (!selectedListing) return;
    setBusy(true);
    try {
      const response = await apiFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          listingId: selectedListing.id,
          reportedUserId: selectedListing.ownerId,
          reason,
          detail,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Report could not be sent.");
      setSheet(null);
      showToast("Report sent to moderation.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Report could not be sent.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const transitionDeal = async (
    deal: Deal,
    action: "cancel" | "mark_delivered" | "confirm_received" | "dispute"
  ) => {
    setBusy(true);
    try {
      const response = await apiFetch(`/api/deals/${deal.id}/transition`, {
        method: "POST",
        body: JSON.stringify({ action, detail: "" }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Deal could not be updated.");
      await loadSession();
      showToast(
        action === "confirm_received"
          ? "Deal completed. You can now leave a review."
          : "Deal updated.",
        "success"
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Deal could not be updated.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const changeTab = (next: Tab) => {
    setTab(next);
    setQuery("");
    telegram?.HapticFeedback?.impactOccurred("light");
  };

  return (
    <div className="page-shell">
      <div className="mini-app">
        <AppHeader
          session={session}
          connected={Boolean(wallet)}
          onCreate={() => openCreate()}
        />

        <div className="screen-scroll">
          {tab === "market" && (
            <MarketScreen
              listings={filteredMarket}
              query={query}
              setQuery={setQuery}
              category={marketCategory}
              setCategory={setMarketCategory}
              onOpen={openListing}
            />
          )}
          {tab === "work" && (
            <WorkScreen
              listings={filteredWork}
              query={query}
              setQuery={setQuery}
              category={workCategory}
              setCategory={setWorkCategory}
              onOpen={openListing}
              onCreate={() => openCreate("work")}
            />
          )}
          {tab === "wallet" && (
            <WalletScreen
              walletAddress={walletAddress}
              walletConnected={Boolean(wallet)}
              deals={deals}
              network={config.network}
              walletVerified={walletVerified}
              currentUserId={session?.id}
              onConnect={() => void tonConnectUi.openModal()}
              onDisconnect={() => void tonConnectUi.disconnect()}
              onDealAction={transitionDeal}
            />
          )}
          {tab === "profile" && (
            <ProfileScreen
              user={session}
              listingCount={listings.filter(
                (listing) => listing.ownerId === session?.id
              ).length}
              connected={Boolean(wallet)}
              onCreate={() => openCreate()}
              onEdit={() => {
                if (session) setSheet("profile");
              }}
              onSafety={() => {
                window.location.assign("/safety");
              }}
            />
          )}
        </div>

        <BottomNavigation tab={tab} onChange={changeTab} />

        {selectedListing && sheet === "listing" && (
          <BottomSheet
            open
            onClose={() => setSheet(null)}
            title={selectedListing.title}
          >
            <ListingSheet
              listing={selectedListing}
              currentUser={session}
              hasApplied={applications.some(
                (application) =>
                  application.listingId === selectedListing.id &&
                  application.status !== "withdrawn"
              )}
              onClose={() => setSheet(null)}
              onPay={startPayment}
              onApply={openApply}
              onReport={(listing) => {
                setSelectedListing(listing);
                setSheet("report");
              }}
              busy={busy}
            />
          </BottomSheet>
        )}

        {sheet === "create" && (
          <CreateSheet
            open
            initialSection={createSection}
            onClose={() => setSheet(null)}
            onSubmit={publishListing}
            busy={busy}
            canPublish={Boolean(session)}
          />
        )}

        <ApplySheet
          key={selectedListing?.id ?? "none"}
          open={sheet === "apply"}
          listing={selectedListing}
          onClose={() => setSheet(null)}
          onSubmit={submitApplication}
          busy={busy}
        />

        {session && (
          <ProfileEditSheet
            key={`${session.id}:${session.updatedAt}`}
            open={sheet === "profile"}
            user={session}
            busy={busy}
            onClose={() => setSheet(null)}
            onSubmit={updateProfile}
          />
        )}

        <ReportSheet
          key={selectedListing?.id ?? "no-report"}
          open={sheet === "report"}
          listing={selectedListing}
          busy={busy}
          onClose={() => setSheet(null)}
          onSubmit={submitReport}
        />

        <PaymentSuccessSheet
          open={sheet === "payment"}
          deal={paymentDeal}
          onClose={() => {
            setSheet(null);
            setTab("wallet");
          }}
        />

        <PaymentQuoteSheet
          open={sheet === "checkout"}
          listing={selectedListing}
          busy={busy}
          onClose={() => setSheet("listing")}
          onConfirm={confirmPayment}
        />

        {toast && <Toast message={toast.message} tone={toast.tone} />}
      </div>
    </div>
  );
}

/** Points charged on admin approval for a rental listing (after free slots are used). */
export const AD_POST_COST_RENT = 20;

/** Points charged on admin approval for a sale listing (after free slots are used). */
export const AD_POST_COST_SALE = 50;

/** @deprecated use AD_POST_COST_RENT or getAdPostPointsCost */
export const AD_POST_COST = AD_POST_COST_RENT;

export type ListingPurpose = "rent" | "sale";

export function getAdPostPointsCost(purpose: ListingPurpose): number {
  return purpose === "sale" ? AD_POST_COST_SALE : AD_POST_COST_RENT;
}

export type PointsPackageId = "basic" | "achiever" | "king";

export type PointsPackage = {
  id: PointsPackageId;
  nameEn: string;
  nameAr: string;
  points: number;
  priceEGP: number;
  popular?: boolean;
};

export const POINTS_PACKAGES: PointsPackage[] = [
  { id: "basic", nameEn: "Basic", nameAr: "أساسي", points: 20, priceEGP: 20 },
  {
    id: "achiever",
    nameEn: "The Achiever",
    nameAr: "المنجز",
    points: 100,
    priceEGP: 80,
    popular: true,
  },
  { id: "king", nameEn: "The King", nameAr: "البرنس", points: 250, priceEGP: 200 },
];

export function getPackageById(id: PointsPackageId): PointsPackage | undefined {
  return POINTS_PACKAGES.find((p) => p.id === id);
}

/** Wallet number shown for manual transfer (Vodafone Cash / Instapay). */
export function getWalletDisplayNumber(): string {
  return (
    process.env.NEXT_PUBLIC_DOWARLI_WALLET_PHONE?.trim() ||
    "01000000000 — عيّن NEXT_PUBLIC_DOWARLI_WALLET_PHONE"
  );
}

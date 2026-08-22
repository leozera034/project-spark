export type PublicOrderReviewState = {
  available: boolean;
  submitted?: boolean;
  reason?: string | null;
  orderNumber?: number | null;
  fulfillment?: "entrega" | "retirada";
  review?: {
    overallRating: number;
    foodRating: number | null;
    deliveryRating: number | null;
    comment: string | null;
    merchantReply: string | null;
    repliedAt: string | null;
    createdAt: string;
  };
};

export type SubmitOrderReviewInput = {
  token: string;
  overallRating: number;
  foodRating?: number | null;
  deliveryRating?: number | null;
  comment?: string | null;
};

export type SubmitOrderReviewResult = {
  ok: boolean;
  error?: string;
  reused?: boolean;
  review?: {
    id: string;
    overallRating: number;
    createdAt: string;
  };
};

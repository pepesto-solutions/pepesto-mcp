import { z } from "zod";

export const SupermarketDomain = z
  .string()
  .min(1)
  .describe(
    "Supermarket domain or ID, e.g. 'coop.ch', 'tesco.com', 'ah.nl'. See README for the full list.",
  );

export const KgToken = z.string().min(1).describe("Pepesto recipe KgToken from /parse or /suggest.");

export const SkuItem = z
  .object({
    session_token: z
      .string()
      .min(1)
      .describe("Per-product session_token returned in the /products response."),
    num_units_to_buy: z.number().int().positive().describe("Quantity to add to the cart."),
  })
  .describe("A concrete SKU selected from /products and the quantity to buy.");

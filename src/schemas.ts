import { z } from "zod";

export const SupermarketDomain = z
  .string()
  .min(1)
  .describe(
    "Supermarket domain or ID, e.g. 'coop.ch', 'tesco.com', 'ah.nl'. See README for the full list.",
  );

export const KgToken = z.string().min(1).describe("Pepesto recipe KgToken from /parse or /suggest.");

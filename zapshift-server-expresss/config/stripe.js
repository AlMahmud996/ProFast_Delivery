import Stripe from "stripe";

// Stripe (secret key stays on the server only)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

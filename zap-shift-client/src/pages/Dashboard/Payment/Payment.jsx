import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import PaymentForm from "./PaymentForm";

// Outside the component, so it is created only once
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PK);
const Payment = () => {
    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-[#CAEB66] mb-6">Payment</h2>
            <Elements stripe={stripePromise}>
                <PaymentForm />
            </Elements>
        </div>
    );
};

export default Payment;
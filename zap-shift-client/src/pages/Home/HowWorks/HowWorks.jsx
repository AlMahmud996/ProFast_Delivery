import { FiTruck, FiMap } from "react-icons/fi";
import HowWorksCard from "./HowWorksCard";

const howWorks = [
    {
        id: 1,
        icon: FiTruck,
        title: "Booking Pick & Drop",
        description:
            "From personal packages to business shipments — we deliver on time, every time.",
    },
    {
        id: 2,
        icon: FiMap,
        title: "Cash On Delivery",
        description:
            "From personal packages to business shipments — we deliver on time, every time.",
    },

    {
        id: 3,
        icon: FiMap,
        title: "Delivery Hub",
        description:
            "From personal packages to business shipments — we deliver on time, every time.",
    },

    {
        id: 4,
        icon: FiMap,
        title: "Booking SME & Corporate",
        description:
            "From personal packages to business shipments — we deliver on time, every time.",
    }

]

const HowWorks = () => {

    return (
        <section className="py-16 md:py-24 rounded-4xl bg-base-200 mb-5">
            <div className="container mx-auto px-4">

                <div className="text-center max-w-2xl mx-auto mb-12">
                    <span className="text-primary font-semibold uppercase tracking-widest text-3xl">
                        How it Works
                    </span>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {howWorks.map((hw) => (
                        <HowWorksCard
                            key={hw.id}
                            howWorks={hw}
                        />
                    ))}
                </div>

            </div>
        </section>
    );
};

export default HowWorks;
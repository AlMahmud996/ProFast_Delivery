
import {
    FiTruck,
    FiMap,
    FiPackage,
    FiDollarSign,
    FiBriefcase,
    FiRefreshCw,
} from "react-icons/fi";

import ServiceCard from "./ServiceCard";

const services = [
    {
        id: 1,
        icon: FiTruck,
        title: "Express & Standard Delivery",
        description:
            "We deliver parcels within 24–72 hours in Dhaka, Chittagong, Sylhet, Khulna, and Rajshahi. Express delivery available in Dhaka within 4–6 hours from pick-up to drop-off.",
    },
    {
        id: 2,
        icon: FiMap,
        title: "Nationwide Delivery",
        description:
            "We deliver parcels nationwide with home delivery in every district, ensuring your products reach customers within 48–72 hours.",
    },
    {
        id: 3,
        icon: FiPackage,
        title: "Fulfillment Solution",
        description:
            "We also offer customized service with inventory management support, online order processing, packaging, and after sales support.",
    },
    {
        id: 4,
        icon: FiDollarSign,
        title: "Cash on Home Delivery",
        description:
            "100% cash on delivery anywhere in Bangladesh with guaranteed safety of your product.",
    },
    {
        id: 5,
        icon: FiBriefcase,
        title: "Corporate Service / Contract In Logistics",
        description:
            "Customized corporate services which includes warehouse and inventory management support.",
    },
    {
        id: 6,
        icon: FiRefreshCw,
        title: "Parcel Return",
        description:
            "Through our reverse logistics facility we allow end customers to return or exchange their products with online business merchants.",
    },
];

const Services = () => {
    return (
        <section className="py-16 md:py-24 rounded-4xl bg-base-200">
            <div className="container mx-auto px-4">

                <div className="text-center max-w-2xl mx-auto mb-12">
                    <span className="text-primary font-semibold uppercase tracking-widest text-3xl">
                        Our Services
                    </span>

                    <h2 className="text-3xl md:text-3xl font-bold mt-3 mb-5">
                        We Provide the Best Delivery Services
                    </h2>

                    <p className="text-base-content/70 leading-relaxed">
                        Enjoy fast, reliable parcel delivery with real-time tracking
                        and zero hassle. From personal packages to business
                        shipments - we deliver on time, every time.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {services.map((service) => (
                        <ServiceCard
                            key={service.id}
                            service = {service}
                        />
                    ))}
                </div>

            </div>
        </section>
    );
};

export default Services;
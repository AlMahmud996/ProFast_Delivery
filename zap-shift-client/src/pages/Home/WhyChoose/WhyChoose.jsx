
import {
  MapPinned,
  ShieldCheck,
  Headset,
} from "lucide-react";

const features = [
  {
    id: 1,
    icon: MapPinned,
    title: "Live Parcel Tracking",
    description:
      "Stay updated in real-time with our live parcel tracking feature. From pick-up to delivery, monitor your shipment's journey and get instant status updates for complete peace of mind.",
  },
  {
    id: 2,
    icon: ShieldCheck,
    title: "100% Safe Delivery",
    description:
      "We ensure your parcels are handled with the utmost care and delivered securely to their destination. Our reliable process guarantees safe and damage-free delivery every time.",
  },
  {
    id: 3,
    icon: Headset,
    title: "24/7 Call Center Support",
    description:
      "Our dedicated support team is available around the clock to assist you with any questions, updates, or delivery concerns—anytime you need us.",
  },
];

const WhyChooseUs = () => {
  return (
    <section className="bg-black text-white py-16 md:py-24 mb-5">
      <div className="max-w-7xl mx-auto px-4 md:px-8">

        {/* Top Dashed Border */}
        <div className="border-t border-dashed border-teal-700 mb-12" />

        {/* Feature Cards */}
        <div className="flex flex-col gap-5 md:gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.id}
                className="flex flex-col sm:flex-row items-center
                  bg-[#111827] rounded-2xl p-6 md:p-8
                  border border-white/5
                  hover:border-teal-500/40
                  transition-all duration-300
                  gap-6 md:gap-8"
              >
                {/* Icon Section */}
                <div
                  className="w-full sm:w-44 md:w-52 shrink-0
                    flex items-center justify-center
                    sm:border-r sm:border-dashed
                    sm:border-teal-600/70
                    sm:pr-6 sm:mr-1
                    pb-5 sm:pb-0
                    border-b border-dashed border-teal-600/70
                    sm:border-b-0"
                >
                  <div className="w-28 h-28 md:w-32 md:h-32
                    rounded-2xl bg-teal-500/10
                    flex items-center justify-center
                    text-teal-400
                    transition-transform duration-300
                    hover:scale-110"
                  >
                    <Icon
                      size={76}
                      strokeWidth={1.2}
                    />
                  </div>
                </div>

                {/* Text Section */}
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-xl md:text-2xl
                    font-bold text-white mb-3"
                  >
                    {feature.title}
                  </h3>

                  <p className="text-sm md:text-base
                    text-gray-400 leading-7"
                  >
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Dashed Border */}
        <div className="border-t border-dashed border-teal-700 mt-12" />

      </div>
    </section>
  );
};

export default WhyChooseUs;
import company1 from "../../../assets/brands/amazon.png";
import company2 from "../../../assets/brands/amazon_vector.png";
import company3 from "../../../assets/brands/casio.png";
import company4 from "../../../assets/brands/moonstar.png";
import company5 from "../../../assets/brands/randstad.png";
import company6 from "../../../assets/brands/start.png";
import company7 from "../../../assets/brands/start-people 1.png";

const logos = [
  { id: 1, name: "Company 1", src: company1 },
  { id: 2, name: "Company 2", src: company2 },
  { id: 3, name: "Company 3", src: company3 },
  { id: 4, name: "Company 4", src: company4 },
  { id: 5, name: "Company 5", src: company5 },
  { id: 6, name: "Company 6", src: company6 },
  { id: 7, name: "Company 7", src: company7 },
];

const ClientLogoMarquee = () => {
  return (
    <section className="py-16 bg-base-100 overflow-hidden">
      <div className="container mx-auto px-4">

        {/* Heading */}
        <div className="text-center mb-10">
          <p className="text-primary font-semibold uppercase tracking-widest text-3xl">
            Our Clients
          </p>

          <h2 className="text-2xl md:text-3xl font-bold mt-2">
            Trusted by Leading Companies
          </h2>

          <p className="text-base-content/60 mt-3">
            We are proud to work with businesses that trust our services.
          </p>
        </div>

        {/* Marquee */}
        <marquee
          direction="left"
          scrollAmount="5"
          behavior="scroll"
          onMouseOver={(e) => e.currentTarget.stop()}
          onMouseOut={(e) => e.currentTarget.start()}
        >
          <div className="flex items-center gap-26 py-4">
            {logos.map((logo) => (
              <div
                key={logo.id}
                className="flex items-center justify-center w-36 h-16 shrink-0"
              >
                <img
                  src={logo.src}
                  alt={logo.name}
                  className="w-full h-6 object-contain"
                />
              </div>
            ))}
          </div>
        </marquee>

      </div>
    </section>
  );
};

export default ClientLogoMarquee;
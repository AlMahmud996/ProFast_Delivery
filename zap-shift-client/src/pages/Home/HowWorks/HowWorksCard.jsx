
const HowWorksCard = ({ howWorks}) => {

    const { icon: Icon, title, description } = howWorks

    return (
        <div className="card w-68 bg-base-100 border border-base-300 shadow-sm ">
            <div className="card-body items-start gap-4 p-6">
                <div className="p-4 rounded-xl bg-primary/10  text-primary">
                    <Icon size={30} />
                </div>

                <h3 className="card-title text-xl font-bold">
                    {title}
                </h3>

                <p className="text-base-content/70 leading-relaxed">
                    {description}
                </p>
            </div>
        </div>
    );
};

export default HowWorksCard;
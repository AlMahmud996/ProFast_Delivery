const ServiceCard = ({ service }) => {

    const { icon: Icon, title, description } = service

    return (
        <div className="card bg-base-100 border border-base-300 shadow-sm hover:shadow-xl hover:-translate-y-1 focus:outline-2 focus:outline-offset-2 focus:outline-violet-300 hover:bg-violet-800 transition-all duration-700">
            <div className="card-body items-center gap-4 p-6">
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

export default ServiceCard;
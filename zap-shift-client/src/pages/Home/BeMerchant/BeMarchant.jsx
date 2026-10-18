import merchant from '../../../assets/location-merchant.png'

const BeMarchant = () => {
    return (
        <div data-aos="zoom-in-up" className="card rounded-4xl bg-[url('assets/be-a-merchant-bg.png')] bg-no-repeat bg-[#033730] mb-5 shadow-sm p-12 flex flex-col lg:flex-row-reverse">
            <div className="card-body card-side">
                <div className="w-full lg:w-1/2 flex flex-col gap-6">
                    <div className="">
                        <h2 className="card-title text-4xl font-extrabold flex flex-wrap mb-6">
                            Merchant and Customer Satisfaction
                            is Our First Priority
                        </h2>
                        <p className='text-xl'>We offer the lowest delivery charge with the highest value along with 100% safety of your product. Pathao courier delivers your parcels in every corner of Bangladesh right on time.</p>
                    </div>
                    <div className="card-actions justify-start">
                        <button className="btn w-1/3 text-xl h-12 rounded-full hover:bg-transparent hover:text-white hover:border-white text-black font-bold bg-[#CAEB66]">Be a Merchant</button>
                        <button className="btn w-1/2 text-xl h-12 rounded-full  text-[#CAEB66] btn-outline">Earn with Profast Courier</button>
                    </div>
                </div>
                <div className='w-full lg:w-1/2 flex justify-center '>
                    <img src={merchant} alt="" />
                </div>
            </div>
        </div>
    )
}

export default BeMarchant
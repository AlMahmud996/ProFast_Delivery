import Banner from "../Banner/Banner"
import BeMarchant from "../BeMerchant/BeMarchant"
import ClientLogoMarquee from "../ClientLogoMarquee/ClientLogoMarquee"
import HowWorks from "../HowWorks/HowWorks"
import Services from "../services/Services"
import WhyChooseUs from "../WhyChoose/WhyChoose"

const Home = () => {
    return (
        <div>
            <Banner></Banner>
            <HowWorks></HowWorks>
            <Services></Services>
            <ClientLogoMarquee></ClientLogoMarquee>
            <WhyChooseUs></WhyChooseUs>
            <BeMarchant></BeMarchant>
        </div>
    )
}

export default Home
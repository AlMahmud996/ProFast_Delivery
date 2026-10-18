import { Link } from 'react-router'
import logo from '../../../assets/logo.png'

const ProFastLogo = () => {
    return (
        <Link to="/">
            <div className='flex items-end'>
                <img className='mb-2' src={logo} alt="" />
                <p className='text-3xl -ml-2 font-extrabold'>ProFast</p>
            </div>
        </Link>
    )
}

export default ProFastLogo
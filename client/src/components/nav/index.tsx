import { Link, useLocation, useNavigate} from "react-router"
import { NavRoutes } from "./routes"
import { useAuthStore } from "../../store/authStore"

export default function Nav() {

    const {user, logout} = useAuthStore();
    const navigate = useNavigate();

    const { pathname } = useLocation();

    return (
        <nav className="w-full h-12 flex items-center justify-between px-4">
            <Link to="/">
                <h1 className="font-bold">Mist</h1>
            </Link>

            <div className="flex gap-2">
                <div className="flex gap-2 items-center">
                    {NavRoutes.map((route) => (
                        <Link to={route.href} key={route.href} 
                            className={`px-4 py-1 text-sm hover:bg-gray-100 ${pathname==route.href && "bg-gray-300"}`}
                        >{route.label}</Link>
                    ))}
                </div>


                {user ? (
                    <div className="flex gap-2 text-sm">
                        <Link to={"/user/profile"}>
                            {user.username}
                        </Link>
                        <button
                            onClick={() => {
                                logout();
                                navigate('/login');
                            }}
                            className="px-4 py-1 bg-gray-200 hover:bg-gray-300 text-sm"
                        >
                            Logout
                        </button>
                    </div>
                ) :  (
                    <Link to={"/login"} className="text-sm px-4 py-1 bg-gray-200 hover:bg-gray-300">Login</Link>
                )}
            </div>
        </nav>
    )
}

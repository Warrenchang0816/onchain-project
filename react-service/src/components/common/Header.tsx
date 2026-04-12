import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { getAuthMe } from "../../api/authApi";
import WalletConnectPanel from "../wallet/WalletConnectPanel";

const Header = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        getAuthMe()
            .then((res) => setIsAuthenticated(res.authenticated))
            .catch(() => setIsAuthenticated(false));
    }, []);

    return (
        <header>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h2>On-chain Task Tracker</h2>

                    <nav>
                        <NavLink
                            to="/"
                            className={({ isActive }) =>
                                isActive ? "nav-link active" : "nav-link"
                            }
                        >
                            Home
                        </NavLink>

                        <NavLink
                            to="/tasks"
                            className={({ isActive }) =>
                                isActive ? "nav-link active" : "nav-link"
                            }
                        >
                            Tasks
                        </NavLink>

                        {isAuthenticated && (
                            <NavLink
                                to="/logs"
                                className={({ isActive }) =>
                                    isActive ? "nav-link active" : "nav-link"
                                }
                            >
                                History
                            </NavLink>
                        )}
                    </nav>
                </div>

                <WalletConnectPanel />
            </div>
        </header>
    );
};

export default Header;
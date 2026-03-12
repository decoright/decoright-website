
import { Outlet } from "react-router-dom"
import { NavBar } from "@/components/navigation/NavBar"

export default function ClientLayout () {
    return (
        <>
            <header className="content-container relative flex justify-center w-full z-50">
                <NavBar/>
            </header>

            <Outlet/>

        </>
    )
}
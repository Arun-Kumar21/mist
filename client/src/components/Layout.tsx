import { Outlet } from 'react-router';
import Nav from './nav/Index';

export default function Layout() {
    return (
        <div className="min-h-screen flex flex-col max-w-4xl mx-auto">
            <Nav />
            <main className="flex-1">
                <Outlet />
            </main>
        </div>
    );
}

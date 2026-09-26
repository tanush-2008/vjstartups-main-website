import { ReactNode, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { SiteNav, SiteFooter } from "./site/SiteChrome";
import FloatingActionButton from "./FloatingActionButton";

interface LayoutProps {
  children?: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="overflow-x-hidden">
        <Suspense fallback={<div className="min-h-[70vh]" aria-busy="true" />}>{children ?? <Outlet />}</Suspense>
      </main>
      <SiteFooter />
      <FloatingActionButton />
    </div>
  );
};

export default Layout;

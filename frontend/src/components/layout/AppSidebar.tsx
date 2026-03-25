import {
  LayoutDashboard,
  Layout,
  Image,
  ListMusic,
  Calendar,
  CreditCard,
  Settings,
  Tv,
  LogOut,
  Shield,
} from "lucide-react";
import { NavLink } from "@/components/layout/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { authApi } from "@/services/api/auth";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Spaces", url: "/screens", icon: Layout },

  { title: "Media Library", url: "/media", icon: Image },
  { title: "Playlists", url: "/playlists", icon: ListMusic },
  { title: "Schedules", url: "/schedules", icon: Calendar },
  { title: "Billing", url: "/billing", icon: CreditCard },
  { title: "Audit Log", url: "/audit", icon: Shield },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
            <img src="/logo.png" alt="ScreenFlow Logo" className="h-full w-full object-cover" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-foreground">
              ScreenFlow
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.url === "/"
                        ? location.pathname === "/"
                        : location.pathname.startsWith(item.url)
                    }
                  >
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-accent/50"
                      activeClassName="bg-accent text-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-9"
          onClick={() => authApi.logout()}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Log out</span>}
        </Button>
        {!collapsed && (
          <p className="text-[10px] text-muted-foreground text-center">© 2026 ScreenFlow</p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

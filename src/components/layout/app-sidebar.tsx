import { Activity, Boxes, Database, FileSearch, HelpCircle, LayoutDashboard, Layers, Layers2, Network, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import logo from "@/assets/harbr-icon.png";
import { useHelpSection } from "@/hooks/use-help-section";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Containers", url: "/containers", icon: Boxes },
  { title: "Compose", url: "/compose", icon: Layers2 },
  { title: "Images", url: "/images", icon: Layers },
  { title: "Volumes", url: "/volumes", icon: Database },
  { title: "Networks", url: "/networks", icon: Network },
  { title: "Logs", url: "/logs", icon: FileSearch },
  { title: "Activity", url: "/events", icon: Activity },
];

function SidebarLogo() {
  const { state } = useSidebar();
  return (
    <SidebarHeader className="px-3 py-3">
      <div className="flex items-center gap-2.5">
        <img src={logo} alt="Harbr" className="h-9 w-auto shrink-0 object-contain" />
        {state === "expanded" && (
          <span className="text-2xl tracking-tight" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>harbr</span>
        )}
      </div>
    </SidebarHeader>
  );
}

export function AppSidebar() {
  const { setOpen, isNarrow } = useSidebar();
  const closeOnNav = () => { if (isNarrow) setOpen(false); };
  const helpSection = useHelpSection();

  return (
    <Sidebar collapsible="icon">
      <SidebarLogo />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Local</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title} onClick={closeOnNav}>
                    <Link
                      to={item.url}
                      activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Help" onClick={closeOnNav}>
              <Link
                to="/help"
                search={{ section: helpSection }}
                activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
              >
                <HelpCircle className="h-4 w-4" />
                <span>Help</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Preferences" onClick={closeOnNav}>
              <Link
                to="/settings"
                activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
              >
                <Settings className="h-4 w-4" />
                <span>Preferences</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

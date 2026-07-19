import { Activity, Boxes, Database, FileSearch, HelpCircle, LayoutDashboard, Layers, Layers2, Network, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import logoLight from "@/assets/harbr-logo-light.png";
import logoDark from "@/assets/harbr-logo-dark.png";
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
        <img src={logoLight} alt="Harbr" className="h-9 w-auto shrink-0 object-contain dark:hidden" />
        <img src={logoDark} alt="Harbr" className="hidden h-9 w-auto shrink-0 object-contain dark:block" />
        {state === "expanded" && (
          <span className="text-[1.7rem] tracking-tight" style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700 }}>Harbr</span>
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

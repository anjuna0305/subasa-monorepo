import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { styled, useTheme, Theme, CSSObject } from "@mui/material/styles";
import Box from "@mui/material/Box";
import MuiDrawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import AppRegistrationIcon from "@mui/icons-material/AppRegistration";
import ChatIcon from "@mui/icons-material/Chat";
import MicIcon from "@mui/icons-material/Mic";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import StreamIcon from "@mui/icons-material/Stream";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ListAltIcon from "@mui/icons-material/ListAlt";
import PeopleIcon from "@mui/icons-material/People";
import { Service } from "@/types/service";
import { isAdmin, isOrgAdmin } from "@/utils/auth";
import { useAuth } from "@/hooks/useAuth";
import { useOrganiztion } from "@/hooks/organiztion/useOrganization";
import { Avatar, Typography } from "@mui/material";
import { useUser } from "@/hooks/user/user";
import { toUpperCase } from "zod";

const drawerWidth = 240;

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: "hidden",
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: "hidden",
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up("sm")]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== "open",
})(({ theme }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  variants: [
    {
      props: ({ open }) => open,
      style: {
        ...openedMixin(theme),
        "& .MuiDrawer-paper": openedMixin(theme),
      },
    },
    {
      props: ({ open }) => !open,
      style: {
        ...closedMixin(theme),
        "& .MuiDrawer-paper": closedMixin(theme),
      },
    },
  ],
}));

const serviceIconMap: Record<string, React.ReactElement> = {
  "subasa-chatbot": <ChatIcon />,
  "subasa-asr": <MicIcon />,
  "subasa-tts": <RecordVoiceOverIcon />,
  "goverment-chatbot": <AccountBalanceIcon />,
  "make-chatbot": <SmartToyIcon />,
  "voice-stream": <StreamIcon />,
  "admin-dashboard": <DashboardIcon />,
  "admin-custom-chatbot": <ListAltIcon />,
  "admin-users": <PeopleIcon />,
};

interface SideBarProps {
  services: Service[];
}

export default function SideBar({ services }: SideBarProps) {
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const { role, logout, isAuthenticated, organization_uuid } = useAuth();

  const open = isAdmin(role) || isOrgAdmin(role) ? true : !collapsed;

  const handleToggle = () => {
    setCollapsed(!collapsed);
  };

  const isActive = (path: string) => {
    if (path === "/admin") return pathname === "/admin";
    return pathname.startsWith(path);
  };

  // const { data: org } = useOrganiztion(organization_uuid || "");
  const { data: user } = useUser();

  return (
    <Box sx={{ display: "flex" }}>
      <Drawer variant="permanent" open={open}>
        {isAdmin(role) || isOrgAdmin(role) ? (
          <DrawerHeader>
            <Box
              sx={{
                gap: 2,
                width: "100%",
                px: 2,
                display: "flex",
                alignItems: "center",
              }}
            >
              <Avatar src={user?.avatar_url ? user.avatar_url : ""} sx={{ width: 48, height: 48 }}>
                {user?.name[0].toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="h6">{role}</Typography>
                <Typography variant="body2" gutterBottom>
                  {/* {org?.name} */}
                </Typography>
              </Box>
            </Box>
          </DrawerHeader>
        ) : (
          <DrawerHeader>
            <Box
              sx={{
                width: "100%",
                px: 2,
                display: "flex",
                alignItems: "center",
              }}
            >
              <Avatar
                src={user?.avatar_url ? user.avatar_url : ""}
                sx={{ width: 48, height: 48 }}
              >
                {user?.name[0].toUpperCase()}
              </Avatar>
              {/*<Box sx={{ fontWeight: "bold", fontSize: "1.1rem" }}>
                General user
              </Box>*/}
            </Box>
            {open ? (
              <IconButton onClick={handleToggle}>
                {theme.direction === "rtl" ? (
                  <ChevronRightIcon />
                ) : (
                  <ChevronLeftIcon />
                )}
              </IconButton>
            ) : (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                onClick={handleToggle}
                edge="start"
              >
                <MenuIcon />
              </IconButton>
            )}
          </DrawerHeader>
        )}
        <Divider />

        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {
            <List>
              {services.map((service) => (
                <ListItem
                  key={service.uuid}
                  disablePadding
                  sx={{ display: "block" }}
                >
                  <ListItemButton
                    onClick={() => navigate(service.path)}
                    sx={[
                      {
                        minHeight: 48,
                        px: 2.5,
                      },
                      isActive(service.path)
                        ? {
                            backgroundColor: theme.palette.action.selected,
                            borderRight: `3px solid ${theme.palette.primary.main}`,
                          }
                        : {},
                    ]}
                  >
                    <ListItemIcon
                      sx={[
                        isActive(service.path)
                          ? {
                              color: theme.palette.primary.main,
                            }
                          : {},
                        {
                          minWidth: 0,
                          justifyContent: "center",
                          mr: 3,
                        },
                      ]}
                    >
                      {serviceIconMap[service.serviceCodeName] || <ChatIcon />}
                    </ListItemIcon>
                    <ListItemText
                      primary={service.serviceDisplayName}
                      sx={{ opacity: 1 }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          }
        </Box>

        <Box sx={{ marginTop: "auto" }}>
          <Divider />
          <List>
            <ListItem disablePadding sx={{ display: "block" }}>
              <ListItemButton
                sx={[
                  {
                    minHeight: 48,
                    px: 2.5,
                  },
                  open
                    ? { justifyContent: "initial" }
                    : { justifyContent: "center" },
                ]}
              >
                <ListItemIcon
                  sx={[
                    {
                      minWidth: 0,
                      justifyContent: "center",
                    },
                    open ? { mr: 3 } : { mr: "auto" },
                  ]}
                >
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText
                  primary={"Settings"}
                  sx={[open ? { opacity: 1 } : { opacity: 0 }]}
                />
              </ListItemButton>

              {isAuthenticated ? (
                <ListItemButton
                  sx={[
                    {
                      minHeight: 48,
                      px: 2.5,
                    },
                    open
                      ? { justifyContent: "initial" }
                      : { justifyContent: "center" },
                  ]}
                  onClick={logout}
                >
                  <ListItemIcon
                    sx={[
                      {
                        minWidth: 0,
                        justifyContent: "center",
                      },
                      open ? { mr: 3 } : { mr: "auto" },
                    ]}
                  >
                    <LogoutIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={"Log out"}
                    sx={[open ? { opacity: 1 } : { opacity: 0 }]}
                  />
                </ListItemButton>
              ) : (
                <ListItemButton
                  sx={[
                    {
                      minHeight: 48,
                      px: 2.5,
                    },
                    open
                      ? { justifyContent: "initial" }
                      : { justifyContent: "center" },
                  ]}
                  onClick={logout}
                >
                  <ListItemIcon
                    sx={[
                      {
                        minWidth: 0,
                        justifyContent: "center",
                      },
                      open ? { mr: 3 } : { mr: "auto" },
                    ]}
                  >
                    <AppRegistrationIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={"Log out"}
                    sx={[open ? { opacity: 1 } : { opacity: 0 }]}
                  />
                </ListItemButton>
              )}
            </ListItem>
          </List>
        </Box>
      </Drawer>
    </Box>
  );
}

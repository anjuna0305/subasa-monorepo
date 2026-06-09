import { isAdmin } from "@/utils/auth";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router";
import { useEffect, useRef } from "react";

export default function AdminGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirected = useRef(false);

  useEffect(() => {
    if (!role || !isAdmin(role)) {
      redirected.current = true;
      const redirectPath = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?redirect=${redirectPath}`, { replace: true });
    }
  }, [isAuthenticated, role, navigate, location]);

  if (!role || !isAdmin(role)) return null;
  return <>{children}</>;
}
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router";
import { ReactNode, useEffect, useRef } from "react";

interface Props {
  roleValidators?: ((role: string) => boolean)[];
  children: ReactNode;
}

export default function AuthGuard({ children, roleValidators }: Props) {
  const { isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirected = useRef(false);

  let roleAuth = true;

  if (roleValidators && role) {
    let tempAuth = false;
    roleValidators.map((authFunc) => {
      tempAuth = tempAuth || authFunc(role);
    });
    if (!tempAuth) roleAuth = false;
  }

  useEffect(() => {
    if (!roleAuth || (!isAuthenticated && !redirected.current)) {
      redirected.current = true;
      const redirectPath = encodeURIComponent(
        location.pathname + location.search,
      );
      navigate(`/login?redirect=${redirectPath}`, { replace: true });
    }
  }, [isAuthenticated, navigate, roleAuth, location]);

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

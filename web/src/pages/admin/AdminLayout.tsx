import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client.ts";
import { Logo } from "../../components/Logo.tsx";
import { Button } from "../../components/ui.tsx";

export function AdminLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["admin", "me"], queryFn: () => api("/admin/me") });

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) navigate("/admin/login", { replace: true });
  }, [me.error, navigate]);

  const logout = async () => {
    await api("/admin/logout", { body: {} });
    queryClient.removeQueries({ queryKey: ["admin"] });
    navigate("/admin/login");
  };

  if (!me.isSuccess) {
    return (
      <main className="page">
        <p className="muted">Cargando…</p>
      </main>
    );
  }

  return (
    <main className="page page-wide">
      <header className="admin-header">
        <Link to="/admin" className="logo" aria-label="Reading Champions · Admin">
          <Logo size={36} />
          <span className="chip chip-accent">Admin</span>
        </Link>
        <Button variant="ghost" size="sm" onClick={logout} icon={<LogOut size={18} aria-hidden />}>
          Cerrar sesión
        </Button>
      </header>
      <Outlet />
    </main>
  );
}

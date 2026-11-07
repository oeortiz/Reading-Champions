import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./pages/admin/AdminLayout.tsx";
import { AdminLogin } from "./pages/admin/AdminLogin.tsx";
import { ReadingEditor } from "./pages/admin/ReadingEditor.tsx";
import { ReadingList } from "./pages/admin/ReadingList.tsx";
import { Ingreso } from "./pages/Ingreso.tsx";
import { Lectura } from "./pages/Lectura.tsx";
import { Resumen } from "./pages/Resumen.tsx";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Ingreso />} />
      <Route path="/lectura" element={<Lectura />} />
      <Route path="/resumen" element={<Resumen />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<ReadingList />} />
        <Route path="lecturas/:id" element={<ReadingEditor />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

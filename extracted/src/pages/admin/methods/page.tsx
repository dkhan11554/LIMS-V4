import { Navigate } from "react-router-dom";

// Methods are managed as a tab within the Test Catalogue page
export default function TestMethodsPage() {
  return <Navigate to="/admin/tests" replace />;
}

import { createBrowserRouter, Link } from 'react-router';
import { SystemStatusPage } from '../features/system-status/SystemStatusPage';
import { AppLayout } from './AppLayout';

function NotFoundPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="text-indigo-600 hover:underline dark:text-indigo-400">
        Back to system status
      </Link>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <SystemStatusPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

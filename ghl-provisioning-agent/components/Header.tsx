import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Settings, Menu } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <span className="text-lg font-bold text-white">G</span>
            </div>
            <span className="text-xl font-bold text-gray-900">
              GHL Provisioning
            </span>
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-700 transition-colors hover:text-primary"
            >
              Dashboard
            </Link>
            <Link
              href="/provision"
              className="text-sm font-medium text-gray-700 transition-colors hover:text-primary"
            >
              New Provision
            </Link>
            <Link
              href="/jobs"
              className="text-sm font-medium text-gray-700 transition-colors hover:text-primary"
            >
              Jobs
            </Link>
            <Link
              href="/snapshots"
              className="text-sm font-medium text-gray-700 transition-colors hover:text-primary"
            >
              Snapshots
            </Link>
          </nav>

          <Link href="/settings">
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
              <span className="sr-only">Settings</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

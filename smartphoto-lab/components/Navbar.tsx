import React from 'react';
import { Camera, LogOut, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Camera className="h-8 w-8 text-primary" />
            <span className="ml-2 text-xl font-bold text-slate-800">SmartPhoto Lab</span>
          </div>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <div className="hidden md:flex items-center text-sm text-slate-600">
                  <UserIcon className="h-4 w-4 mr-1" />
                  {user.username}
                </div>
                <button
                  onClick={onLogout}
                  className="flex items-center text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  退出
                </button>
              </>
            ) : (
              <span className="text-sm text-slate-500">访客模式</span>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
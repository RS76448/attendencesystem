import React from 'react';
import { User, LogOut, Calendar, Users, BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function Layout({ children, title }: LayoutProps) {
  const { currentUser, logout } = useAuth();

  const getRoleIcon = () => {
    switch (currentUser?.role) {
      case 'admin':
        return <Users className="w-5 h-5" />;
      case 'faculty':
        return <BookOpen className="w-5 h-5" />;
      case 'student':
        return <Calendar className="w-5 h-5" />;
      default:
        return <User className="w-5 h-5" />;
    }
  };

  const getRoleColor = () => {
    switch (currentUser?.role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'faculty':
        return 'bg-blue-100 text-blue-800';
      case 'student':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-8 h-8 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900">AttendanceApp</h1>
              </div>
              <div className="hidden sm:block text-gray-500">|</div>
              <h2 className="hidden sm:block text-lg font-medium text-gray-700">{title}</h2>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor()}`}>
                  <div className="flex items-center space-x-1">
                    {getRoleIcon()}
                    <span className="capitalize">{currentUser?.role}</span>
                  </div>
                </div>
                <div className="text-sm text-gray-700">
                  <div className="font-medium">{currentUser?.displayName}</div>
                  <div className="text-gray-500">{currentUser?.email}</div>
                </div>
              </div>
              
              <button
                onClick={() => logout()}
                className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
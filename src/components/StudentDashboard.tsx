import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { TimeTableEntry, AttendanceRequest } from '../types';
import { Calendar, Clock, AlertCircle, CheckCircle, XCircle, Plus, BookOpen, FileText } from 'lucide-react';
import Layout from './Layout';
import StudentRequestForm from './StudentRequestForm';
import WeeklyTimetableView from './WeeklyTimetableView';

export default function StudentDashboard() {
  const { currentUser } = useAuth();
  const [timetable, setTimetable] = useState<TimeTableEntry[]>([]);
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timetable' | 'new-request' | 'my-requests'>('timetable');
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser) {
      loadTimetable();
      loadRequests();
    }
  }, [currentUser]);

  const loadTimetable = async () => {
    try {
      if (!currentUser?.course || !currentUser?.semester) {
        setError('Course or semester information missing from your profile.');
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, 'timetables'),
        where('course', '==', currentUser.course),
        where('semester', '==', currentUser.semester)
      );
      
      const snapshot = await getDocs(q);
      const timetableData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TimeTableEntry[];
      
      if (timetableData.length === 0) {
        setError('No timetable available for your course and semester.');
      } else {
        setError('');
      }
      
      setTimetable(timetableData);
    } catch (error) {
      console.error('Error loading timetable:', error);
      setError('Failed to load timetable.');
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      if (!currentUser) return;

      const q = query(
        collection(db, 'attendanceRequests'),
        where('studentId', '==', currentUser.uid),
        orderBy('submittedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const requestsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AttendanceRequest[];
      
      setRequests(requestsData);
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getDayName = (day: string) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[parseInt(day)] || day;
  };

  if (loading) {
    return (
      <Layout title="Student Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Student Dashboard">
      <div className="space-y-6 sm:space-y-8">

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Student Info */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Student Information</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-medium text-sm sm:text-base">{currentUser?.displayName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">PRN</p>
              <p className="font-medium text-sm sm:text-base">{currentUser?.prn || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Course</p>
              <p className="font-medium text-sm sm:text-base">{currentUser?.course || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Semester</p>
              <p className="font-medium text-sm sm:text-base">{currentUser?.semester || 'Not set'}</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex overflow-x-auto space-x-2 sm:space-x-8 px-3 sm:px-6" aria-label="Tabs">
              {[
                { key: 'timetable', label: 'My Timetable', icon: BookOpen },
                { key: 'new-request', label: 'New Request', icon: Plus },
                { key: 'my-requests', label: 'My Requests', icon: FileText },
              ].map((tab) => {
                const Icon = tab.icon;
                    return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`${
                      activeTab === tab.key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors flex items-center space-x-1 sm:space-x-2 flex-shrink-0`}
                  >
                    <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                  </button>
                    );
                  })}
            </nav>
              </div>

          <div className="p-4 sm:p-6">
            {/* Timetable Tab */}
            {activeTab === 'timetable' && (
              <div className="space-y-4">
                {timetable.length > 0 ? (
                  <WeeklyTimetableView timetable={timetable} />
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-lg font-medium">No Timetable Available</p>
                    <p className="text-sm">Your timetable will appear here once it's created by your faculty.</p>
              </div>
                )}
          </div>
        )}

            {/* New Request Tab */}
            {activeTab === 'new-request' && (
              <div className="space-y-4">
                {timetable.length > 0 ? (
                  <StudentRequestForm onRequestSubmitted={() => {
                    loadRequests();
                    setActiveTab('my-requests');
                  }} />
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <Plus className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-lg font-medium">No Timetable Available</p>
                    <p className="text-sm">You need a timetable to create absence requests. Please contact your faculty.</p>
          </div>
        )}
          </div>
        )}

            {/* My Requests Tab */}
            {activeTab === 'my-requests' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">My Absence Requests</h3>
                  <span className="text-sm text-gray-500">{requests.length} total</span>
          </div>

          {requests.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-lg font-medium">No Requests Yet</p>
                    <p className="text-sm">You haven't submitted any absence requests yet.</p>
            </div>
          ) : (
                  <div className="space-y-4">
              {requests.map(request => (
                      <div key={request.id} className="bg-gray-50 rounded-lg p-4 sm:p-6 border border-gray-200">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-2 sm:space-y-0">
                          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(request.status)}
                          <span className="capitalize">{request.status}</span>
                        </div>
                      </div>
                            <div className="text-xs sm:text-sm text-gray-500">
                              <div>Submitted: {request?.submittedAt && (new Date(request?.submittedAt))?.toLocaleDateString()}</div>
                              {request.processedAt && (
                                <div>Processed: {new Date(request.processedAt)?.toLocaleDateString()}</div>
                              )}
                            </div>
                    </div>
                  </div>
                  
                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-2">Absence Details</p>
                          <div className="bg-white rounded-lg p-4 space-y-3">
                      {(
                        Array.isArray((request as any).classDetails)
                          ? (request as any).classDetails
                          : [(request as any).classDetails]
                      ).map((cd: any, idx: number) => (
                              <div key={idx} className="bg-gray-50 rounded-md p-3 border border-gray-200">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Subject</p>
                                    <p className="font-medium text-gray-900">{cd.subject}</p>
                                </div>
                          <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Faculty</p>
                                    <p className="font-medium text-gray-900">{cd.facultyName}</p>
                          </div>
                          <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Date</p>
                                    <p className="font-medium text-gray-900">{getDayName(cd.day)}</p>
                          </div>
                          <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Time</p>
                                    <p className="font-medium text-gray-900">{cd.time}</p>
                                </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">Reason for Absence</p>
                    <p className="text-gray-800">{request.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
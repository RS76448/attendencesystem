import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { TimeTableEntry, AttendanceRequest } from '../types';
import { Calendar, Clock, AlertCircle, CheckCircle, XCircle, Plus } from 'lucide-react';
import Layout from './Layout';
import StudentRequestForm from './StudentRequestForm';
import WeeklyTimetableView from './WeeklyTimetableView';

export default function StudentDashboard() {
  const { currentUser } = useAuth();
  const [timetable, setTimetable] = useState<TimeTableEntry[]>([]);
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
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
      console.log(timetableData);
      setTimetable(timetableData);
    } catch (error) {
      console.error('Error loading timetable:', error);
      setError('Failed to load timetable. Please try again.');
    }
    setLoading(false);
  };

  const loadRequests = async () => {
    try {
      console.log(currentUser);
      const q = query(
        collection(db, 'attendanceRequests'),
        where('studentId', '==', currentUser?.uid),
        orderBy('submittedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const requestsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate(),
        processedAt: doc.data().processedAt?.toDate(),
      })) as AttendanceRequest[];
      
      setRequests(requestsData);
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
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
      <div className="space-y-8">

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Student Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Student Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-medium">{currentUser?.displayName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">PRN</p>
              <p className="font-medium">{currentUser?.prn || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Course</p>
              <p className="font-medium">{currentUser?.course || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Semester</p>
              <p className="font-medium">{currentUser?.semester || 'Not set'}</p>
            </div>
          </div>
        </div>

        {/* Request Form */}
        {showRequestForm && (
          <StudentRequestForm onRequestSubmitted={() => {
            setShowRequestForm(false);
            loadRequests();
          }} />
        )}

        {/* Action Button */}
        {!showRequestForm && timetable.length > 0 && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowRequestForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Request</span>
            </button>
          </div>
        )}

        {/* Timetable */}
        {timetable.length > 0 && (
          <WeeklyTimetableView timetable={timetable} />
        )}

        {/* My Requests */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              My Absence Requests
            </h2>
            <p className="text-sm text-gray-500 mt-1">Track your attendance requests and their status</p>
          </div>
          {requests.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No attendance requests submitted yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {requests.map(request => (
                <div key={request.id} className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(request.status)}
                          <span className="capitalize">{request.status}</span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        <div>Submitted: {request.submittedAt?.toLocaleDateString()}</div>
                        {request.processedAt && (
                          <div>Processed: {request.processedAt.toLocaleDateString()}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Absence Details</p>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      {(
                        Array.isArray((request as any).classDetails)
                          ? (request as any).classDetails
                          : [(request as any).classDetails]
                      ).map((cd: any, idx: number) => (
                        <div key={idx} className="bg-white rounded-md p-3 border border-gray-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Subject</p>
                              <p className="font-medium text-gray-900">{cd.subject}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Date of Absence</p>
                              <p className="font-medium text-gray-900">
                                {cd.date ? new Date(cd.date).toLocaleDateString() : 
                                 cd.dayName ? cd.dayName : 
                                 cd.day ? getDayName(cd.day) : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Time</p>
                              <p className="font-medium text-gray-900">{cd.time || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Faculty</p>
                              <p className="font-medium text-gray-900">{request.facultyName}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 mb-1">Reason for Absence</p>
                    <p className="text-gray-800">{request.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
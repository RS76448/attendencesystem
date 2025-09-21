import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, orderBy, limit, startAfter } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { TimeTableEntry, AttendanceRequest } from '../types';
import { Calendar, Clock, Book, User, AlertCircle, CheckCircle, XCircle, Plus } from 'lucide-react';
import Layout from './Layout';

export default function StudentDashboard() {
  const { currentUser } = useAuth();
  const [timetable, setTimetable] = useState<TimeTableEntry[]>([]);
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedClass, setSelectedClass] = useState<TimeTableEntry | null>(null);
  const [reason, setReason] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      setError('Failed to load timetable. Please try again.');
    }
    setLoading(false);
  };

  const loadRequests = async () => {
    try {
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

  const checkDuplicateRequest = (classEntry: TimeTableEntry, date: string) => {
    return requests.some(request => 
      request.classDetails.subject === classEntry.subject &&
      request.classDetails.date === date &&
      request.classDetails.time === classEntry.time &&
      request.status !== 'rejected'
    );
  };

  const submitRequest = async () => {
    if (!selectedClass || !selectedDate || !reason.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (checkDuplicateRequest(selectedClass, selectedDate)) {
      setError('You have already submitted a request for this class on the selected date.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const requestData: Omit<AttendanceRequest, 'id'> = {
        studentId: currentUser!.uid,
        studentName: currentUser!.displayName,
        prn: currentUser!.prn || '',
        course: currentUser!.course || '',
        semester: currentUser!.semester || '',
        facultyId: selectedClass.facultyId,
        facultyName: selectedClass.facultyName,
        classDetails: {
          subject: selectedClass.subject,
          date: selectedDate,
          time: selectedClass.time,
          day: selectedClass.day,
        },
        reason: reason.trim(),
        status: 'pending',
        submittedAt: new Date(),
      };

      await addDoc(collection(db, 'attendanceRequests'), requestData);
      setSuccess('Request submitted successfully!');
      setShowRequestForm(false);
      setSelectedClass(null);
      setReason('');
      setSelectedDate('');
      loadRequests();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error submitting request:', error);
      setError('Failed to submit request. Please try again.');
    }
    
    setSubmitting(false);
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
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        )}

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
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Submit Attendance Request</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Class
                </label>
                <select
                  value={selectedClass?.id || ''}
                  onChange={(e) => {
                    const classEntry = timetable.find(t => t.id === e.target.value);
                    setSelectedClass(classEntry || null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a class</option>
                  {timetable.map(entry => (
                    <option key={entry.id} value={entry.id}>
                      {entry.subject} - {getDayName(entry.day)} {entry.time} ({entry.facultyName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Absence
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Absence
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Please provide a detailed reason for your absence..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={submitRequest}
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
                <button
                  onClick={() => setShowRequestForm(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
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
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Your Timetable</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Faculty</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {timetable.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {getDayName(entry.day)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{entry.time}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Book className="w-4 h-4" />
                          <span>{entry.subject}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <User className="w-4 h-4" />
                          <span>{entry.facultyName}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* My Requests */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">My Requests</h2>
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
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(request.status)}
                          <span className="capitalize">{request.status}</span>
                        </div>
                      </div>
                      <span className="text-sm text-gray-500">
                        Submitted {request.submittedAt?.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div>
                      <p className="text-sm text-gray-500">Subject</p>
                      <p className="font-medium">{request.classDetails.subject}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Date & Time</p>
                      <p className="font-medium">
                        {new Date(request.classDetails.date).toLocaleDateString()} - {request.classDetails.time}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Faculty</p>
                      <p className="font-medium">{request.facultyName}</p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Reason</p>
                    <p className="text-gray-800">{request.reason}</p>
                  </div>
                  
                  {request.processedAt && (
                    <div className="mt-2 text-sm text-gray-500">
                      Processed on {request.processedAt.toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
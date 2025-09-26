import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, orderBy, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { AttendanceRequest, TimeTableEntry } from '../types';
import { CheckCircle, XCircle, Clock, Calendar, User, AlertCircle, Undo2, BookOpen, Plus, Trash2, Save } from 'lucide-react';
import Layout from './Layout';
import TimetableEntryModal from './TimetableEntryModal';
import { getCurrentWeekDates, formatTimeSlot, WeekDate } from '../utils/weekUtils';

export default function FacultyDashboard() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [timetable, setTimetable] = useState<any>({});
  const [weekDates, setWeekDates] = useState<WeekDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [activeTab, setActiveTab] = useState<'requests' | 'timetable'>('requests');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<{dayOfWeek: string, dayName: string} | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser) {
      loadRequests();
      loadTimetable();
      setWeekDates(getCurrentWeekDates());
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadRequests();
    }
  }, [filter]);

  const loadRequests = async () => {
    try {
      let q;
      if (filter === 'all') {
        q = query(
          collection(db, 'attendanceRequests'),
          where('facultyId', '==', currentUser?.facultyId || currentUser?.uid),
          orderBy('submittedAt', 'desc')
        );
      } else {
        q = query(
          collection(db, 'attendanceRequests'),
          where('facultyId', '==', currentUser?.facultyId || currentUser?.uid),
          where('status', '==', filter),
          orderBy('submittedAt', 'desc')
        );
      }
      
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
      setError('Failed to load requests. Please try again.');
    }
    setLoading(false);
  };

  const loadTimetable = async () => {
    try {
      const q = query(
        collection(db, 'timetables'),
        where('facultyId', '==', currentUser?.facultyId || currentUser?.uid)
      );
      const snapshot = await getDocs(q);
      const entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      // Convert per-entry docs to weekly map { [day]: { [time]: slot } }
      const weekly: any = {};
      entries.forEach(e => {
        const dayKey = String(e.day);
        if (!weekly[dayKey]) weekly[dayKey] = {};
        weekly[dayKey][e.time] = {
          id: e.id,
          subject: e.subject,
          facultyId: e.facultyId,
          facultyName: e.facultyName,
          time: e.time,
          course: e.course,
          semester: e.semester,
        };
      });
      setTimetable(weekly);
    } catch (error) {
      console.error('Error loading timetable:', error);
    }
  };

  const openAddEntryModal = (dayOfWeek: string, dayName: string) => {
    setSelectedDay({ dayOfWeek, dayName });
    setModalOpen(true);
  };

  const addTimetableEntry = async (entry: any) => {
    if (!selectedDay) return;
    
    const dayOfWeek = selectedDay.dayOfWeek;
    const newTimetable = { ...timetable };
    
    if (!newTimetable[dayOfWeek]) {
      newTimetable[dayOfWeek] = {};
    }
    
    newTimetable[dayOfWeek][entry.time] = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    setTimetable(newTimetable);
    setModalOpen(false);
    setSelectedDay(null);

    // Persist per-entry doc to match admin format
    try {
      const weekDate = weekDates.find(wd => wd.dayOfWeek.toString() === dayOfWeek);
      await addDoc(collection(db, 'timetables'), {
        course: entry.course,
        semester: entry.semester,
        day: dayOfWeek,
        date: weekDate?.date.toISOString().split('T')[0] || '',
        time: entry.time,
        subject: entry.subject,
        facultyId: currentUser?.facultyId || currentUser?.uid,
        facultyName: currentUser?.displayName,
      });
      setSuccess('Class added successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error adding class:', err);
      setError('Failed to save class');
      setTimeout(() => setError(''), 3000);
    }
  };

  const removeTimeSlot = async (dayOfWeek: string, timeSlot: string) => {
    const newTimetable = { ...timetable };
    if (newTimetable[dayOfWeek] && newTimetable[dayOfWeek][timeSlot]) {
      delete newTimetable[dayOfWeek][timeSlot];
      setTimetable(newTimetable);
      try {
        const q = query(
          collection(db, 'timetables'),
          where('facultyId', '==', currentUser?.facultyId || currentUser?.uid),
          where('day', '==', dayOfWeek),
          where('time', '==', timeSlot)
        );
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await deleteDoc(doc(db, 'timetables', d.id));
        }
      } catch (err) {
        console.error('Error removing class:', err);
        setError('Failed to remove class');
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  const saveTimetable = async () => {
    // Optional: could bulk re-sync if needed; per-entry persist already done on add/remove
    setSaving(true);
    setTimeout(() => setSaving(false), 500);
  };

  useEffect(() => {
    if (currentUser) {
      loadRequests();
    }
  }, [filter]);

  const processRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    setProcessing(requestId);
    setError('');

    try {
      const requestRef = doc(db, 'attendanceRequests', requestId);
      const currentRequest = requests.find(r => r.id === requestId);
      
      // Update the request status
      await updateDoc(requestRef, {
        status,
        processedAt: new Date(),
        previousStatus: currentRequest?.status,
      });

      // Update teacher status based on approval/rejection
      if (currentRequest) {
        const teacherRef = doc(db, 'users', currentRequest.facultyId);
        const teacherStatus = status === 'approved' ? 'approved' : 'rejected';
        
        await updateDoc(teacherRef, {
          status: teacherStatus,
          lastStatusUpdate: new Date()
        });
      }

      setSuccess(`Request ${status} successfully!`);
      loadRequests();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error processing request:', error);
      setError('Failed to process request. Please try again.');
    }
    
    setProcessing(null);
  };

  const undoAction = async (requestId: string) => {
    setProcessing(requestId);
    setError('');

    try {
      const requestRef = doc(db, 'attendanceRequests', requestId);
      const currentRequest = requests.find(r => r.id === requestId);
      
      // Update the request status
      await updateDoc(requestRef, {
        status: currentRequest?.previousStatus || 'pending',
        processedAt: null,
        previousStatus: null,
      });

      // Reset teacher status when undoing action
      if (currentRequest) {
        const teacherRef = doc(db, 'users', currentRequest.facultyId);
        
        await updateDoc(teacherRef, {
          status: 'pending',
          lastStatusUpdate: new Date()
        });
      }

      setSuccess('Action undone successfully!');
      loadRequests();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error undoing action:', error);
      setError('Failed to undo action. Please try again.');
    }
    
    setProcessing(null);
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

  const filteredRequests = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  if (loading) {
    return (
      <Layout title="Faculty Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Faculty Dashboard">
    
      <div className="space-y-6">
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-xl sm:text-3xl font-bold text-gray-900">{requests.length}</p>
              </div>
              <Calendar className="w-5 h-5 sm:w-8 sm:h-8 text-gray-400 flex-shrink-0" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Pending</p>
                <p className="text-xl sm:text-3xl font-bold text-yellow-600">{pendingCount}</p>
              </div>
              <Clock className="w-5 h-5 sm:w-8 sm:h-8 text-yellow-400 flex-shrink-0" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Approved</p>
                <p className="text-xl sm:text-3xl font-bold text-green-600">{approvedCount}</p>
              </div>
              <CheckCircle className="w-5 h-5 sm:w-8 sm:h-8 text-green-400 flex-shrink-0" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-xl sm:text-3xl font-bold text-red-600">{rejectedCount}</p>
              </div>
              <XCircle className="w-5 h-5 sm:w-8 sm:h-8 text-red-400 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 px-3 sm:px-6">
              <button
                onClick={() => setActiveTab('requests')}
                className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm ${
                  activeTab === 'requests'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Attendance Requests</span>
                  <span className="sm:hidden">Requests</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('timetable')}
                className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm ${
                  activeTab === 'timetable'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <BookOpen className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">My Timetable</span>
                  <span className="sm:hidden">Timetable</span>
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'requests' && (
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { key: 'pending', label: 'Pending', count: pendingCount },
                { key: 'approved', label: 'Approved', count: approvedCount },
                { key: 'rejected', label: 'Rejected', count: rejectedCount },
                { key: 'all', label: 'All', count: requests.length },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as any)}
                  className={`${
                    filter === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                      filter === tab.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

        
          <div className="divide-y divide-gray-200">
            {filteredRequests.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No requests found</h3>
                <p>
                  {filter === 'pending' 
                    ? "No pending requests at the moment."
                    : `No ${filter} requests found.`
                  }
                </p>
              </div>
            ) : (
              filteredRequests.map(request => (
                <div key={request.id} className="p-6">
                  <div className="flex items-center justify-between mb-4">
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
                      {request.processedAt && (
                        <span className="text-sm text-gray-500">
                          • Processed {request.processedAt.toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => processRequest(request.id, 'approved')}
                        disabled={processing === request.id}
                        className={`${
                          request.status === 'approved' 
                            ? 'bg-green-500 text-white' 
                            : 'bg-green-600 hover:bg-green-700'
                        } disabled:bg-green-400 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center space-x-1`}
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>{request.status === 'approved' ? 'Approved' : 'Approve'}</span>
                      </button>
                      <button
                        onClick={() => processRequest(request.id, 'rejected')}
                        disabled={processing === request.id}
                        className={`${
                          request.status === 'rejected' 
                            ? 'bg-red-500 text-white' 
                            : 'bg-red-600 hover:bg-red-700'
                        } disabled:bg-red-400 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center space-x-1`}
                      >
                        <XCircle className="w-4 h-4" />
                        <span>{request.status === 'rejected' ? 'Rejected' : 'Reject'}</span>
                      </button>
                      
                      {request.status !== 'pending' && request.processedAt && (
                        <button
                          onClick={() => undoAction(request.id)}
                          disabled={processing === request.id}
                          className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center space-x-1"
                        >
                          <Undo2 className="w-4 h-4" />
                          <span>Undo</span>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Student</p>
                      <div className="flex items-center space-x-1">
                        <User className="w-4 h-4 text-gray-400" />
                        <p className="font-medium">{request.studentName}</p>
                      </div>
                      <p className="text-sm text-gray-500">PRN: {request.prn}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-500">Course & Semester</p>
                      <p className="font-medium">{request.course}</p>
                      <p className="text-sm text-gray-500">Semester {request.semester}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-md divide-y mb-4">
                    {(
                      Array.isArray((request as any).classDetails)
                        ? (request as any).classDetails
                        : [(request as any).classDetails]
                    ).map((cd: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3">
                        <div>
                          <p className="text-sm text-gray-500">Subject</p>
                          <p className="font-medium">{cd.subject}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Date & Time</p>
                          <p className="font-medium">
                            {cd.date ? new Date(cd.date).toLocaleDateString() : '-'}{cd.time ? ` - ${cd.time}` : ''}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Faculty</p>
                          <p className="font-medium">{request.facultyName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Reason for Absence</p>
                    <div className="bg-gray-50 rounded-md p-3">
                      <p className="text-gray-800">{request.reason}</p>
                    </div>
                  </div>
                  
                  {processing === request.id && (
                    <div className="mt-3 flex items-center space-x-2 text-sm text-gray-500">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span>Processing...</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          </div>
        )}

        {/* Timetable Tab */}
        {activeTab == 'timetable' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">My Weekly Timetable</h3>
              <button
                onClick={saveTimetable}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center space-x-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Timetable'}</span>
              </button>
            </div>

            {/* Weekly Timetable Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {weekDates.map(weekDate => {
                const dayOfWeek = weekDate.dayOfWeek.toString();
                const dayEntries = timetable[dayOfWeek] || {};
                const sortedEntries = Object.values(dayEntries).sort((a: any, b: any) => a.time.localeCompare(b.time));

                return (
                  <div
                    key={dayOfWeek}
                    className={`rounded-lg border-2 ${
                      weekDate.isToday
                        ? 'border-blue-500 bg-blue-50'
                        : weekDate.isPast
                        ? 'border-gray-300 bg-gray-100'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    } transition-all duration-200`}
                  >
                    {/* Day Header */}
                    <div className={`p-5 rounded-t-lg ${
                      weekDate.isToday
                        ? 'bg-blue-600 text-white'
                        : weekDate.isPast
                        ? 'bg-gray-400 text-white'
                        : 'bg-gray-600 text-white'
                    }`}>
                      <div className="text-center">
                        <div className="text-xl font-semibold">{weekDate.dayName}</div>
                        <div className="text-sm opacity-90 mt-1">
                          {weekDate.date.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                        {weekDate.isToday && (
                          <div className="text-xs mt-2 opacity-75 bg-white bg-opacity-20 rounded-full px-2 py-1 inline-block">Today</div>
                        )}
                      </div>
                    </div>

                    {/* Classes */}
                    <div className="p-5 min-h-[200px]">
                      {sortedEntries.length === 0 ? (
                        <div className="text-center text-gray-500 py-12">
                          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
                          <p className="text-sm font-medium">No classes</p>
                          <p className="text-xs text-gray-400 mt-1">Add classes using the button below</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {sortedEntries.map((entry: any, index) => (
                            <div
                              key={`${entry.time}-${index}`}
                              className="p-4 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
                            >
                              <div className="space-y-3">
                                {/* Time */}
                                <div className="flex items-center space-x-2">
                                  <Clock className="w-4 h-4 text-blue-600" />
                                  <span className="font-semibold text-sm text-gray-900">
                                    {formatTimeSlot(entry.time)}
                                  </span>
                                </div>

                                {/* Subject */}
                                <div className="flex items-center space-x-2">
                                  <BookOpen className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm font-medium text-gray-800">
                                    {entry.subject}
                                  </span>
                                </div>

                                {/* Faculty */}
                                <div className="flex items-center space-x-2">
                                  <User className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm text-gray-700 truncate">
                                    {entry.facultyName}
                                  </span>
                                </div>

                                {/* Remove Button */}
                                <button
                                  onClick={() => removeTimeSlot(dayOfWeek, entry.time)}
                                  className="w-full text-red-500 hover:text-red-700 text-xs flex items-center justify-center space-x-1 py-2 rounded border border-red-200 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Remove Class</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add Entry Button */}
                    {!weekDate.isPast && (
                      <div className="p-5 border-t border-gray-200 bg-gray-50">
                        <button
                          onClick={() => openAddEntryModal(dayOfWeek, weekDate.dayName)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-sm hover:shadow-md"
                        >
                          <Plus className="w-5 h-5" />
                          <span>Add Class</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Timetable Entry Modal */}
        {modalOpen && selectedDay && (
          <TimetableEntryModal
            isOpen={modalOpen}
            dayOfWeek={selectedDay.dayOfWeek}
            dayName={selectedDay.dayName}
            facultyList={[{ facultyId: currentUser?.facultyId || currentUser?.uid, displayName: currentUser?.displayName || '' } as any]}
            existingEntries={timetable[selectedDay.dayOfWeek] || {}}
            onClose={() => {
              setModalOpen(false);
              setSelectedDay(null);
            }}
            onSave={addTimetableEntry}
            readOnlyFaculty={true}
          />
        )}
     
      </div>
    </Layout>
  );
}
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { TimeTableEntry, AttendanceRequest, User as AppUser } from '../types';
import { getCurrentWeekDates, formatTimeSlot, isTimeSlotInPast, WeekDate, checkTimeOverlap } from '../utils/weekUtils';
import { Calendar, Clock, Book, User, AlertCircle, CheckCircle, XCircle, Plus, Save, X } from 'lucide-react';

interface StudentRequestFormProps {
  onRequestSubmitted: () => void;
}

interface TimetableSlot {
  id: string;
  subject: string;
  facultyId: string;
  facultyName: string;
  time: string;
  day: string;
}

interface DayTimetable {
  [timeSlot: string]: TimetableSlot;
}

interface WeeklyTimetable {
  [dayOfWeek: string]: DayTimetable;
}

export default function StudentRequestForm({ onRequestSubmitted }: StudentRequestFormProps) {
  const { currentUser } = useAuth();
  const [weekDates, setWeekDates] = useState<WeekDate[]>([]);
  const [timetable, setTimetable] = useState<WeeklyTimetable>({});
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [facultyList, setFacultyList] = useState<AppUser[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<Record<string, boolean>>({});
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // No fixed time slots - we'll get them from the timetable data

  useEffect(() => {
    setWeekDates(getCurrentWeekDates());
    if (currentUser) {
      loadTimetable();
      loadRequests();
      loadFaculty();
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
      
      // Convert to weekly timetable structure
      const weeklyTimetable: WeeklyTimetable = {};
      
      timetableData.forEach(entry => {
        if (!weeklyTimetable[entry.day]) {
          weeklyTimetable[entry.day] = {};
        }
        
        weeklyTimetable[entry.day][entry.time] = {
          id: entry.id,
          subject: entry.subject,
          facultyId: entry.facultyId,
          facultyName: entry.facultyName,
          time: entry.time,
          day: entry.day
        };
      });
      
      setTimetable(weeklyTimetable);
      setError('');
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

  const loadFaculty = async () => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'faculty'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ uid: d.id, ...(d.data() as any) })) as AppUser[];
      setFacultyList(data);
    } catch (e) {
      console.error('Error loading faculty:', e);
    }
  };

  const checkDuplicateRequest = (slot: TimetableSlot, weekDate: WeekDate) => {
    return requests.some(request => {
      const details = Array.isArray((request as any).classDetails)
        ? (request as any).classDetails
        : [(request as any).classDetails];
      return details.some((d: any) =>
        d?.subject === slot.subject && 
        d?.day === slot.day && 
        (d?.time === slot.time || checkTimeOverlap(d?.time || '', slot.time)) && 
        request.status !== 'rejected'
      );
    });
  };

  const toggleSlotSelection = (dayOfWeek: string, timeSlot: string, slot: TimetableSlot) => {
    const weekDate = weekDates.find(wd => wd.dayOfWeek.toString() === dayOfWeek);
    if (!weekDate) return;

    const slotKey = `${dayOfWeek}|${timeSlot}`;
    
    // Check if slot is in the past
    if (weekDate.isPast || isTimeSlotInPast(weekDate.date, timeSlot)) {
      setError('Cannot select past time slots');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Check for duplicate requests
    if (checkDuplicateRequest(slot, weekDate)) {
      setError(`You already have a pending request for ${slot.subject} on ${weekDate.dayName}`);
      setTimeout(() => setError(''), 3000);
      return;
    }

    setSelectedSlots(prev => ({
      ...prev,
      [slotKey]: !prev[slotKey]
    }));
  };

  const submitRequest = async () => {
    const selectedSlotKeys = Object.keys(selectedSlots).filter(key => selectedSlots[key]);
    
    if (selectedSlotKeys.length === 0) {
      setError('Please select at least one class slot');
      return;
    }

    if (!selectedFacultyId) {
      setError('Please select a faculty member');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for your absence');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const faculty = facultyList.find(f => (f.facultyId || f.uid) === selectedFacultyId);
      const classDetails = selectedSlotKeys.map(slotKey => {
        const [dayOfWeek, timeSlot] = slotKey.split('|');
        const slot = timetable[dayOfWeek][timeSlot];
        console.log(timetable,dayOfWeek,timeSlot,slotKey);
        const weekDate = weekDates.find(wd => wd.dayOfWeek.toString() === dayOfWeek);
        
        return {
          subject: slot.subject,
          date: weekDate?.date.toISOString().split('T')[0] || '',
          time: slot.time,
          day: slot.day,
          dayName: weekDate?.dayName || '',
          timetableEntryId: slot.id,
        };
      });

      const requestData: Omit<AttendanceRequest, 'id'> = {
        studentId: currentUser!.uid,
        studentName: currentUser!.displayName,
        prn: currentUser!.prn || '',
        course: currentUser!.course || '',
        semester: currentUser!.semester || '',
        facultyId: faculty?.facultyId || faculty?.uid || selectedFacultyId,
        facultyName: faculty?.displayName || 'Selected Faculty',
        classDetails,
        reason: reason.trim(),
        status: 'pending',
        submittedAt: new Date(),
      } as any;

      await addDoc(collection(db, 'attendanceRequests'), requestData);
      setSuccess('Request submitted successfully!');
      setSelectedSlots({});
      setReason('');
      setSelectedFacultyId('');
      onRequestSubmitted();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error submitting request:', error);
      setError('Failed to submit request. Please try again.');
    }
    
    setSubmitting(false);
  };

  const isSlotDisabled = (dayOfWeek: string, timeSlot: string, slot: TimetableSlot): boolean => {
    const weekDate = weekDates.find(wd => wd.dayOfWeek.toString() === dayOfWeek);
    if (!weekDate) return true;
    
    return weekDate.isPast || isTimeSlotInPast(weekDate.date, timeSlot) || checkDuplicateRequest(slot, weekDate);
  };

  const getSelectedCount = (): number => {
    return Object.values(selectedSlots).filter(Boolean).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Submit Attendance Request</h2>
      
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Weekly Timetable Grid */}
        <div>
          <h3 className="text-md font-medium text-gray-900 mb-4">
            Select Classes ({getSelectedCount()} selected)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {weekDates.map(weekDate => {
              const dayOfWeek = weekDate.dayOfWeek.toString();
              const dayEntries = timetable[dayOfWeek] || {};
              const sortedEntries = Object.values(dayEntries).sort((a, b) => a.time.localeCompare(b.time));
              
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
                  <div className={`p-4 rounded-t-lg ${
                    weekDate.isToday 
                      ? 'bg-blue-600 text-white' 
                      : weekDate.isPast 
                      ? 'bg-gray-400 text-white' 
                      : 'bg-gray-600 text-white'
                  }`}>
                    <div className="text-center">
                      <div className="text-lg font-semibold">{weekDate.dayName}</div>
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
                  <div className="p-4 min-h-[150px]">
                    {sortedEntries.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium">No classes</p>
                        <p className="text-xs text-gray-400 mt-1">No classes scheduled</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sortedEntries.map((entry, index) => {
                          const slotKey = `${dayOfWeek}|${entry.time}`;
                          const isSelected = !!selectedSlots[slotKey];
                          const isDisabled = isSlotDisabled(dayOfWeek, entry.time, entry);
                          
                          return (
                            <button
                              key={`${entry.time}-${index}`}
                              onClick={() => toggleSlotSelection(dayOfWeek, entry.time, entry)}
                              disabled={isDisabled}
                              className={`w-full p-3 rounded-lg border text-left transition-all ${
                                isSelected 
                                  ? 'border-blue-500 bg-blue-100 text-blue-900' 
                                  : isDisabled
                                  ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                              }`}
                            >
                              <div className="space-y-2">
                                {/* Time */}
                                <div className="flex items-center space-x-2">
                                  <Clock className="w-4 h-4 text-blue-600" />
                                  <span className="font-semibold text-sm">
                                    {formatTimeSlot(entry.time)}
                                  </span>
                                </div>

                                {/* Subject */}
                                <div className="flex items-center space-x-2">
                                  <Book className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm font-medium">
                                    {entry.subject}
                                  </span>
                                </div>

                                {/* Faculty */}
                                <div className="flex items-center space-x-2">
                                  <User className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm text-gray-600 truncate">
                                    {entry.facultyName}
                                  </span>
                                </div>

                                {isSelected && (
                                  <div className="text-xs text-blue-600 font-medium text-center">
                                    ✓ Selected
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Faculty Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Faculty/Approver
          </label>
          <select
            value={selectedFacultyId}
            onChange={(e) => setSelectedFacultyId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose a faculty</option>
            {facultyList.map(f => (
              <option key={f.uid} value={f.facultyId || f.uid}>
                {f.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Reason */}
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

        {/* Submit Button */}
        <div className="flex space-x-3">
          <button
            onClick={submitRequest}
            disabled={submitting || getSelectedCount() === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>{submitting ? 'Submitting...' : 'Submit Request'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

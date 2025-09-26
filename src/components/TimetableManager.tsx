import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { TimeTableEntry, User, Course } from '../types';
import { getCurrentWeekDates, formatTimeSlot, WeekDate } from '../utils/weekUtils';
import { Calendar, Plus, Trash2, Save, X, Clock, Book, User as UserIcon } from 'lucide-react';
import TimetableEntryModal from './TimetableEntryModal';

interface TimetableManagerProps {
  courses: Course[];
  users: User[];
  onTimetableUpdate: () => void;
}

interface TimetableSlot {
  id?: string;
  subject: string;
  facultyId: string;
  facultyName: string;
  time: string;
}

interface DayTimetable {
  [timeSlot: string]: TimetableSlot;
}

interface WeeklyTimetable {
  [dayOfWeek: string]: DayTimetable;
}

export default function TimetableManager({ courses, users, onTimetableUpdate }: TimetableManagerProps) {
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [weekDates, setWeekDates] = useState<WeekDate[]>([]);
  const [timetable, setTimetable] = useState<WeeklyTimetable>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<{dayOfWeek: string, dayName: string} | null>(null);

  const facultyList = users.filter(u => u.role === 'faculty');

  useEffect(() => {
    setWeekDates(getCurrentWeekDates());
  }, []);

  useEffect(() => {
    if (selectedCourse && selectedSemester) {
      loadTimetable();
    }
  }, [selectedCourse, selectedSemester]);

  const loadTimetable = async () => {
    if (!selectedCourse || !selectedSemester) return;
    
    setLoading(true);
    try {
      const q = query(
        collection(db, 'timetables'),
        where('course', '==', selectedCourse),
        where('semester', '==', selectedSemester)
      );
      
      const snapshot = await getDocs(q);
      const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TimeTableEntry[];
      
      // Convert entries to weekly timetable structure
      const weeklyTimetable: WeeklyTimetable = {};
      
      entries.forEach(entry => {
        if (!weeklyTimetable[entry.day]) {
          weeklyTimetable[entry.day] = {};
        }
        
        weeklyTimetable[entry.day][entry.time] = {
          id: entry.id,
          subject: entry.subject,
          facultyId: entry.facultyId,
          facultyName: entry.facultyName,
          time: entry.time
        };
      });
      
      setTimetable(weeklyTimetable);
    } catch (error) {
      console.error('Error loading timetable:', error);
      setError('Failed to load timetable');
    }
    setLoading(false);
  };

  const openAddEntryModal = (dayOfWeek: string, dayName: string) => {
    setSelectedDay({ dayOfWeek, dayName });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedDay(null);
  };

  const addTimetableEntry = (entryData: any) => {
    const { time, subject, facultyId, facultyName } = entryData;
    
    setTimetable(prev => ({
      ...prev,
      [selectedDay!.dayOfWeek]: {
        ...prev[selectedDay!.dayOfWeek],
        [time]: {
          subject,
          facultyId,
          facultyName,
          time
        }
      }
    }));

    // Persist single entry immediately
    void persistSingleEntry(selectedDay!.dayOfWeek, time, { subject, facultyId, facultyName, time });
  };

  const removeTimeSlot = (dayOfWeek: string, timeSlot: string) => {
    setTimetable(prev => {
      const newDayTimetable = { ...prev[dayOfWeek] };
      const removed = newDayTimetable[timeSlot];
      delete newDayTimetable[timeSlot];
      // Persist deletion
      void deleteSingleEntry(dayOfWeek, timeSlot);
      return {
        ...prev,
        [dayOfWeek]: newDayTimetable
      };
    });
  };

  // Persist a single entry for current selected course/semester
  const persistSingleEntry = async (
    dayOfWeek: string,
    timeSlot: string,
    slot: { subject: string; facultyId: string; facultyName: string; time: string }
  ) => {
    if (!selectedCourse || !selectedSemester) return;
    const weekDate = weekDates.find(wd => wd.dayOfWeek.toString() === dayOfWeek);
    // Remove any existing doc for same course/semester/day/time
    const existingQuery = query(
      collection(db, 'timetables'),
      where('course', '==', selectedCourse),
      where('semester', '==', selectedSemester),
      where('day', '==', dayOfWeek),
      where('time', '==', timeSlot)
    );
    const existingSnapshot = await getDocs(existingQuery);
    for (const d of existingSnapshot.docs) {
      await deleteDoc(doc(db, 'timetables', d.id));
    }
    await addDoc(collection(db, 'timetables'), {
      course: selectedCourse,
      semester: selectedSemester,
      day: dayOfWeek,
      date: weekDate?.date.toISOString().split('T')[0] || '',
      time: timeSlot,
      subject: slot.subject,
      facultyId: slot.facultyId,
      facultyName: slot.facultyName,
    });
  };

  const deleteSingleEntry = async (dayOfWeek: string, timeSlot: string) => {
    if (!selectedCourse || !selectedSemester) return;
    const existingQuery = query(
      collection(db, 'timetables'),
      where('course', '==', selectedCourse),
      where('semester', '==', selectedSemester),
      where('day', '==', dayOfWeek),
      where('time', '==', timeSlot)
    );
    const existingSnapshot = await getDocs(existingQuery);
    for (const d of existingSnapshot.docs) {
      await deleteDoc(doc(db, 'timetables', d.id));
    }
  };

  const saveTimetable = async () => {
    if (!selectedCourse || !selectedSemester) {
      setError('Please select course and semester');
      return;
    }

    setSaving(true);
    setError('');
    
    try {
      // Delete existing entries for this course/semester
      const existingQuery = query(
        collection(db, 'timetables'),
        where('course', '==', selectedCourse),
        where('semester', '==', selectedSemester)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      for (const docSnapshot of existingSnapshot.docs) {
        await deleteDoc(doc(db, 'timetables', docSnapshot.id));
      }

      // Add new entries
      const entriesToAdd: Omit<TimeTableEntry, 'id'>[] = [];
      
      Object.entries(timetable).forEach(([dayOfWeek, dayTimetable]) => {
        Object.entries(dayTimetable).forEach(([timeSlot, slot]) => {
          if (slot.subject && slot.facultyId) {
            const weekDate = weekDates.find(wd => wd.dayOfWeek.toString() === dayOfWeek);
            entriesToAdd.push({
              course: selectedCourse,
              semester: selectedSemester,
              day: dayOfWeek,
              date: weekDate?.date.toISOString().split('T')[0] || '',
              time: timeSlot,
              subject: slot.subject,
              facultyId: slot.facultyId,
              facultyName: slot.facultyName
            });
          }
        });
      });

      // Batch add entries
      for (const entry of entriesToAdd) {
        await addDoc(collection(db, 'timetables'), entry);
      }

      setSuccess(`Timetable saved successfully! ${entriesToAdd.length} entries added.`);
      onTimetableUpdate();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving timetable:', error);
      setError('Failed to save timetable');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-green-500" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center space-x-2">
            <X className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Course and Semester Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Select Course & Semester</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              setSelectedSemester('');
              setTimetable({});
            }}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Course</option>
            {courses.map(course => (
              <option key={course.id} value={course.name}>{course.name}</option>
            ))}
          </select>
          
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            disabled={!selectedCourse}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">Select Semester</option>
            {selectedCourse && courses.find(c => c.name === selectedCourse)?.semesters.map(sem => (
              <option key={sem} value={sem}>Semester {sem}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Weekly Timetable Grid */}
      {selectedCourse && selectedSemester && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                Weekly Timetable - {selectedCourse} Semester {selectedSemester}
              </h3>
              <button
                onClick={saveTimetable}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Timetable'}</span>
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
                <div className={`p-4 sm:p-5 rounded-t-lg ${
                  weekDate.isToday
                    ? 'bg-blue-600 text-white'
                    : weekDate.isPast
                    ? 'bg-gray-400 text-white'
                    : 'bg-gray-600 text-white'
                }`}>
                  <div className="text-center">
                    <div className="text-lg sm:text-xl font-semibold">{weekDate.dayName}</div>
                    <div className="text-xs sm:text-sm opacity-90 mt-1">
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
                    <div className="p-4 sm:p-5 min-h-[180px] sm:min-h-[200px]">
                      {sortedEntries.length === 0 ? (
                        <div className="text-center text-gray-500 py-12">
                          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
                          <p className="text-sm font-medium">No classes</p>
                          <p className="text-xs text-gray-400 mt-1">Add classes using the button below</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {sortedEntries.map((entry, index) => (
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
                                  <Book className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm font-medium text-gray-800">
                                    {entry.subject}
                                  </span>
                                </div>

                                {/* Faculty */}
                                <div className="flex items-center space-x-2">
                                  <UserIcon className="w-4 h-4 text-blue-600" />
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
                  <div className="p-4 sm:p-5 border-t border-gray-200 bg-gray-50">
                    <button
                      onClick={() => openAddEntryModal(dayOfWeek, weekDate.dayName)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 sm:py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-sm hover:shadow-md text-sm sm:text-base"
                    >
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>Add Class</span>
                    </button>
                  </div>
                )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Timetable Entry Modal */}
      {selectedDay && (
        <TimetableEntryModal
          isOpen={modalOpen}
          onClose={closeModal}
          onSave={addTimetableEntry}
          dayOfWeek={selectedDay.dayOfWeek}
          dayName={selectedDay.dayName}
          facultyList={facultyList}
          existingEntries={Object.values(timetable[selectedDay.dayOfWeek] || {})}
          showCourseSemester={false}
          readOnlyFaculty={false}
        />
      )}
    </div>
  );
}
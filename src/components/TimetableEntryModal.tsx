import { useState, useEffect } from 'react';
import { X, Clock, Book, User, Save } from 'lucide-react';
import { User as AppUser, Course } from '../types';
import { validateTimeRange, checkTimeOverlap, getTimeOptions } from '../utils/weekUtils';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

interface TimetableEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: TimetableEntryData) => void;
  dayOfWeek: string;
  dayName: string;
  facultyList: AppUser[];
  existingEntries?: any[];
  showCourseSemester?: boolean; // New prop to control course/semester fields
  readOnlyFaculty?: boolean; // New prop to control faculty field behavior
}

interface TimetableEntryData {
  time: string;
  subject: string;
  facultyId: string;
  facultyName: string;
  course: string;
  semester: string;
}

export default function TimetableEntryModal({
  isOpen,
  onClose,
  onSave,
  dayOfWeek,
  dayName,
  facultyList,
  existingEntries = [],
  showCourseSemester = true,
  readOnlyFaculty = true
}: TimetableEntryModalProps) {
  const [formData, setFormData] = useState<TimetableEntryData>({
    time: '',
    subject: '',
    facultyId: '',
    facultyName: '',
    course: '',
    semester: ''
  });
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Get available semesters for selected course
  const getAvailableSemesters = () => {
    const selectedCourse = courses.find(course => course.name === formData.course);
    return selectedCourse?.semesters || [];
  };

  // Load courses from database
  const loadCourses = async () => {
    setLoadingCourses(true);
    try {
      const coursesSnapshot = await getDocs(collection(db, 'courses'));
      const coursesData = coursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Course[];
      setCourses(coursesData);
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoadingCourses(false);
    }
  };

  // Set default faculty when modal opens
  useEffect(() => {
    if (isOpen && facultyList.length > 0) {
      const defaultFaculty = facultyList[0]; // First faculty in the list (logged-in faculty)
      setFormData({
        time: '',
        subject: '',
        facultyId: defaultFaculty.facultyId || defaultFaculty.uid,
        facultyName: defaultFaculty.displayName || defaultFaculty.name,
        course: '',
        semester: ''
      });
      loadCourses(); // Load courses when modal opens
    }
  }, [isOpen, facultyList]);

  // Reset semester when course changes
  useEffect(() => {
    if (formData.course) {
      setFormData(prev => ({ ...prev, semester: '' }));
    }
  }, [formData.course]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    const requiredFields = [!startTime, !endTime, !formData.subject, !formData.facultyId];
    if (showCourseSemester) {
      requiredFields.push(!formData.course, !formData.semester);
    }
    
    if (requiredFields.some(field => field)) {
      setError('Please fill in all required fields.');
      return;
    }

    // Create time range string
    const timeRange = `${startTime} - ${endTime}`;

    // Validate time range format
    const timeValidation = validateTimeRange(timeRange);
    if (!timeValidation.isValid) {
      setError(timeValidation.error || 'Invalid time format');
      return;
    }

    // Check for time conflicts (overlap detection)
    const entriesArray = Array.isArray(existingEntries) ? existingEntries : Object.values(existingEntries);
    const timeConflict = entriesArray.some(entry => 
      checkTimeOverlap(entry.time, timeRange)
    );
    
    if (timeConflict) {
      const conflictingEntry = entriesArray.find(entry => 
        checkTimeOverlap(entry.time, timeRange)
      );
      setError(`Time slot overlaps with existing class "${conflictingEntry?.subject}" (${conflictingEntry?.time}). Please choose a different time.`);
      return;
    }

    // Save with combined time range
    const entryData = { ...formData, time: timeRange };
    onSave(entryData);
    setFormData({ time: '', subject: '', facultyId: '', facultyName: '', course: '', semester: '' });
    setStartTime('');
    setEndTime('');
    onClose();
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            Add Class Entry - {dayName}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Range <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none text-sm"
                  required
                >
                  <option value="">Start Time</option>
                  {getTimeOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none text-sm"
                  required
                >
                  <option value="">End Time</option>
                  {getTimeOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Select start and end time for the class</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Book className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Enter subject name"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Faculty <span className="text-red-500">*</span>
            </label>
            <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            {readOnlyFaculty ? (
              <input
                type="text"
                value={formData.facultyName}
                readOnly
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 cursor-not-allowed"
                placeholder="Faculty name will be auto-selected"
              />
            ) : (
              <select
                value={formData.facultyId}
                onChange={(e) => {
                  const sel = facultyList.find(f => (f.facultyId || (f as any).uid) === e.target.value);
                  setFormData({
                    ...formData,
                    facultyId: e.target.value,
                    facultyName: sel?.displayName || (sel as any)?.name || ''
                  });
                }}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                required
              >
                <option value="">Select Faculty</option>
                {facultyList.map(f => (
                  <option key={(f as any).uid || f.facultyId} value={f.facultyId || (f as any).uid}>
                    {f.displayName || (f as any).name}
                  </option>
                ))}
              </select>
            )}
            </div>
          {readOnlyFaculty ? (
            <p className="text-xs text-gray-500 mt-1">Faculty is automatically selected based on your login</p>
          ) : null}
          </div>

          {showCourseSemester && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Course <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Book className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={formData.course}
                    onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                    required
                    disabled={loadingCourses}
                  >
                    <option value="">
                      {loadingCourses ? 'Loading courses...' : 'Select Course'}
                    </option>
                    {courses.map(course => (
                      <option key={course.id} value={course.name}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                </div>
                {courses.length === 0 && !loadingCourses && (
                  <p className="text-xs text-gray-500 mt-1">No courses available. Please contact admin to add courses.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Semester <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Book className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                    required
                    disabled={!formData.course}
                  >
                    <option value="">
                      {!formData.course ? 'Select course first' : 'Select Semester'}
                    </option>
                    {getAvailableSemesters().map(semester => (
                      <option key={semester} value={semester}>
                        Semester {semester}
                      </option>
                    ))}
                  </select>
                </div>
                {formData.course && getAvailableSemesters().length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">No semesters available for this course.</p>
                )}
              </div>
            </>
          )}

          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center space-x-2 text-sm"
            >
              <Save className="w-4 h-4" />
              <span>Add Entry</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

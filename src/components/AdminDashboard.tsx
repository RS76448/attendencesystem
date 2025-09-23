import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { TimeTableEntry, AttendanceRequest, User, Course } from '../types';
import { Upload, Users, Calendar, BookOpen, Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import Layout from './Layout';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'timetables' | 'users' | 'requests' | 'courses'>('timetables');
  const [timetables, setTimetables] = useState<TimeTableEntry[]>([]);
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Filters for multiple timetables
  const [filterCourse, setFilterCourse] = useState<string>('');
  const [filterSemester, setFilterSemester] = useState<string>('');

  // Timetable form state
  const [showTimetableForm, setShowTimetableForm] = useState(false);
  const [showCsvUploader, setShowCsvUploader] = useState(false);
  const [csvParsing, setCsvParsing] = useState(false);
  const [timetableData, setTimetableData] = useState({
    course: '',
    semester: '',
    day: '',
    time: '',
    subject: '',
    facultyId: '',
    facultyName: ''
  });

  // User form state
  const [showUserForm, setShowUserForm] = useState(false);
  const [userData, setUserData] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'student' as 'student' | 'faculty' | 'admin',
    course: '',
    semester: '',
    prn: '',
    facultyId: ''
  });

  // Course form state
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseData, setCourseData] = useState({
    name: '',
    semesters: ['1', '2', '3', '4', '5', '6', '7', '8']
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        loadTimetables(),
        loadRequests(),
        loadUsers(),
        loadCourses()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data. Please refresh the page.');
    }
    setLoading(false);
  };

  const loadTimetables = async () => {
    const q = query(collection(db, 'timetables'), orderBy('course'), orderBy('semester'));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TimeTableEntry[];
    setTimetables(data);
  };

  const loadRequests = async () => {
    const q = query(collection(db, 'attendanceRequests'), orderBy('submittedAt', 'desc'));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      submittedAt: doc.data().submittedAt?.toDate(),
      processedAt: doc.data().processedAt?.toDate(),
    })) as AttendanceRequest[];
    setRequests(data);
  };

  const loadUsers = async () => {
    const q = query(collection(db, 'users'));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as User[];
    setUsers(data);
  };

  const loadCourses = async () => {
    const q = query(collection(db, 'courses'));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[];
    setCourses(data);
  };

  const addTimetableEntry = async () => {
    try {
      if (!timetableData.course || !timetableData.semester || !timetableData.subject) {
        setError('Please fill in all required fields.');
        return;
      }

      await addDoc(collection(db, 'timetables'), timetableData);
      setSuccess('Timetable entry added successfully!');
      setShowTimetableForm(false);
      setTimetableData({
        course: '',
        semester: '',
        day: '',
        time: '',
        subject: '',
        facultyId: '',
        facultyName: ''
      });
      loadTimetables();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error adding timetable entry:', error);
      setError('Failed to add timetable entry.');
    }
  };

  const handleCsvUpload = async (file: File) => {
    setError('');
    setSuccess('');
    setCsvParsing(true);
    try {
      const text = await file.text();
      // Expected headers: course,semester,day,time,subject,facultyId,facultyName
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) {
        throw new Error('CSV has no data rows.');
      }
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const required = ['course','semester','day','time','subject','facultyid','facultyname'];
      const missing = required.filter(r => !header.includes(r));
      if (missing.length) {
        throw new Error(`Missing columns: ${missing.join(', ')}`);
      }
      const idx = (name: string) => header.indexOf(name);
      const batchEntries: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length !== header.length) continue;
        const entry = {
          course: cols[idx('course')].trim(),
          semester: cols[idx('semester')].trim(),
          day: cols[idx('day')].trim(),
          time: cols[idx('time')].trim(),
          subject: cols[idx('subject')].trim(),
          facultyId: cols[idx('facultyid')].trim(),
          facultyName: cols[idx('facultyname')].trim(),
        };
        if (!entry.course || !entry.semester || !entry.subject) continue;
        batchEntries.push(entry);
      }
      for (const e of batchEntries) {
        await addDoc(collection(db, 'timetables'), e);
      }
      setSuccess(`Uploaded ${batchEntries.length} timetable entries.`);
      setShowCsvUploader(false);
      await loadTimetables();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      console.error('CSV upload error:', e);
      setError(e.message || 'Failed to process CSV.');
    }
    setCsvParsing(false);
  };

  const deleteTimetableEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'timetables', id));
      setSuccess('Timetable entry deleted successfully!');
      loadTimetables();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting timetable entry:', error);
      setError('Failed to delete timetable entry.');
    }
  };

  const addUser = async () => {
    try {
      if (!userData.email || !userData.password || !userData.displayName || !userData.role) {
        setError('Please fill in all required fields.');
        return;
      }

      // Check for duplicate email
      const existingUser = users.find(u => u.email === userData.email);
      if (existingUser) {
        setError('A user with this email already exists.');
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
      
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        displayName: userData.displayName,
        role: userData.role,
        course: userData.role === 'student' ? userData.course : undefined,
        semester: userData.role === 'student' ? userData.semester : undefined,
        prn: userData.role === 'student' ? userData.prn : undefined,
        facultyId: userData.role === 'faculty' ? userData.facultyId : undefined,
      });

      setSuccess('User created successfully!');
      setShowUserForm(false);
      setUserData({
        email: '',
        password: '',
        displayName: '',
        role: 'student',
        course: '',
        semester: '',
        prn: '',
        facultyId: ''
      });
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      console.error('Error creating user:', error);
      if (error.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (error.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters long.');
      } else {
        setError('Failed to create user.');
      }
    }
  };

  const addCourse = async () => {
    try {
      if (!courseData.name) {
        setError('Please enter a course name.');
        return;
      }

      // Check for duplicate course
      const existingCourse = courses.find(c => c.name.toLowerCase() === courseData.name.toLowerCase());
      if (existingCourse) {
        setError('A course with this name already exists.');
        return;
      }

      await addDoc(collection(db, 'courses'), courseData);
      setSuccess('Course added successfully!');
      setShowCourseForm(false);
      setCourseData({ name: '', semesters: ['1', '2', '3', '4', '5', '6', '7', '8'] });
      loadCourses();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error adding course:', error);
      setError('Failed to add course.');
    }
  };

  const deleteCourse = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'courses', id));
      setSuccess('Course deleted successfully!');
      loadCourses();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting course:', error);
      setError('Failed to delete course.');
    }
  };

  const stats = {
    totalUsers: users.length,
    students: users.filter(u => u.role === 'student').length,
    faculty: users.filter(u => u.role === 'faculty').length,
    admins: users.filter(u => u.role === 'admin').length,
    totalRequests: requests.length,
    pendingRequests: requests.filter(r => r.status === 'pending').length,
    approvedRequests: requests.filter(r => r.status === 'approved').length,
    rejectedRequests: requests.filter(r => r.status === 'rejected').length,
  };

  if (loading) {
    return (
      <Layout title="Admin Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Admin Dashboard">
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

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
                <p className="text-sm text-gray-500">
                  {stats.students} Students, {stats.faculty} Faculty, {stats.admins} Admins
                </p>
              </div>
              <Users className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalRequests}</p>
                <p className="text-sm text-gray-500">{stats.pendingRequests} Pending</p>
              </div>
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Timetable Entries</p>
                <p className="text-3xl font-bold text-gray-900">{timetables.length}</p>
                <p className="text-sm text-gray-500">{courses.length} Courses</p>
              </div>
              <BookOpen className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approval Rate</p>
                <p className="text-3xl font-bold text-green-600">
                  {stats.totalRequests > 0 
                    ? Math.round((stats.approvedRequests / (stats.approvedRequests + stats.rejectedRequests)) * 100)
                    : 0}%
                </p>
                <p className="text-sm text-gray-500">
                  {stats.approvedRequests} / {stats.approvedRequests + stats.rejectedRequests}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { key: 'timetables', label: 'Timetables', icon: Calendar },
                { key: 'users', label: 'Users', icon: Users },
                { key: 'courses', label: 'Courses', icon: BookOpen },
                { key: 'requests', label: 'All Requests', icon: Upload },
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
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center space-x-2`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Timetables Tab */}
            {activeTab === 'timetables' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Timetable Management</h3>
                  <div className="flex items-center space-x-2">
                    <label className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center space-x-2 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>{csvParsing ? 'Uploading...' : 'Upload CSV'}</span>
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        disabled={csvParsing}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleCsvUpload(f);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                    <button
                      onClick={() => setShowTimetableForm(true)}
                      className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center space-x-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>New Entry</span>
                    </button>
                  </div>
                </div>

                {showTimetableForm && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <input
                        type="text"
                        placeholder="Course"
                        value={timetableData.course}
                        onChange={(e) => setTimetableData({...timetableData, course: e.target.value})}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Semester"
                        value={timetableData.semester}
                        onChange={(e) => setTimetableData({...timetableData, semester: e.target.value})}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <select
                        value={timetableData.day}
                        onChange={(e) => setTimetableData({...timetableData, day: e.target.value})}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Day</option>
                        <option value="1">Monday</option>
                        <option value="2">Tuesday</option>
                        <option value="3">Wednesday</option>
                        <option value="4">Thursday</option>
                        <option value="5">Friday</option>
                        <option value="6">Saturday</option>
                      </select>
                      <input
                        type="time"
                        value={timetableData.time}
                        onChange={(e) => setTimetableData({...timetableData, time: e.target.value})}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input
                        type="text"
                        placeholder="Subject"
                        value={timetableData.subject}
                        onChange={(e) => setTimetableData({...timetableData, subject: e.target.value})}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Faculty ID"
                        value={timetableData.facultyId}
                        onChange={(e) => setTimetableData({...timetableData, facultyId: e.target.value})}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Faculty Name"
                        value={timetableData.facultyName}
                        onChange={(e) => setTimetableData({...timetableData, facultyName: e.target.value})}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={addTimetableEntry}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                      >
                        Add Entry
                      </button>
                      <button
                        onClick={() => setShowTimetableForm(false)}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <div className="mb-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <select
                      value={filterCourse}
                      onChange={(e) => setFilterCourse(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Courses</option>
                      {Array.from(new Set(timetables.map(t => t.course))).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <select
                      value={filterSemester}
                      onChange={(e) => setFilterSemester(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Semesters</option>
                      {Array.from(new Set(timetables.map(t => t.semester))).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Semester</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Faculty</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {timetables
                        .filter(t => (filterCourse ? t.course === filterCourse : true))
                        .filter(t => (filterSemester ? t.semester === filterSemester : true))
                        .map(entry => (
                        <tr key={entry.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{entry.course}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.semester}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(entry.day)] || entry.day}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.time}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.subject}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.facultyName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button
                              onClick={() => deleteTimetableEntry(entry.id)}
                              className="text-red-600 hover:text-red-900 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">User Management</h3>
                  <button
                    onClick={() => setShowUserForm(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add User</span>
                  </button>
                </div>

                {showUserForm && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="email"
                        placeholder="Email"
                        value={userData.email}
                        onChange={(e) => setUserData({...userData, email: e.target.value})}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={userData.password}
                        onChange={(e) => setUserData({...userData, password: e.target.value})}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Display Name"
                        value={userData.displayName}
                        onChange={(e) => setUserData({...userData, displayName: e.target.value})}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <select
                        value={userData.role}
                        onChange={(e) => setUserData({...userData, role: e.target.value as any})}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="student">Student</option>
                        <option value="faculty">Faculty</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    
                    {userData.role === 'student' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                          type="text"
                          placeholder="Course"
                          value={userData.course}
                          onChange={(e) => setUserData({...userData, course: e.target.value})}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Semester"
                          value={userData.semester}
                          onChange={(e) => setUserData({...userData, semester: e.target.value})}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="PRN"
                          value={userData.prn}
                          onChange={(e) => setUserData({...userData, prn: e.target.value})}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                    
                    {userData.role === 'faculty' && (
                      <input
                        type="text"
                        placeholder="Faculty ID"
                        value={userData.facultyId}
                        onChange={(e) => setUserData({...userData, facultyId: e.target.value})}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={addUser}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                      >
                        Add User
                      </button>
                      <button
                        onClick={() => setShowUserForm(false)}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map(user => (
                        <tr key={user.uid}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.displayName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              user.role === 'admin' ? 'bg-red-100 text-red-800' :
                              user.role === 'faculty' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.role === 'student' && `${user.course} - Sem ${user.semester} - ${user.prn}`}
                            {user.role === 'faculty' && `Faculty ID: ${user.facultyId}`}
                            {user.role === 'admin' && 'Administrator'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.role === 'faculty' && (
                              <div className="flex items-center space-x-2">
                                <button
                                  className="text-blue-600 hover:text-blue-800"
                                  onClick={async () => {
                                    const newName = prompt('Update display name', user.displayName || '');
                                    if (newName === null) return;
                                    const newFacultyId = prompt('Update Faculty ID', user.facultyId || '');
                                    if (newName !== null) {
                                      try {
                                        await updateDoc(doc(db, 'users', user.uid), {
                                          displayName: newName,
                                          facultyId: newFacultyId || ''
                                        });
                                        setSuccess('Faculty updated');
                                        loadUsers();
                                        setTimeout(() => setSuccess(''), 3000);
                                      } catch (e) {
                                        console.error(e);
                                        setError('Failed to update faculty');
                                      }
                                    }
                                  }}
                                >Edit</button>
                                <button
                                  className="text-red-600 hover:text-red-800"
                                  onClick={async () => {
                                    if (!confirm(`Delete user ${user.displayName}? This only removes the profile document.`)) return;
                                    try {
                                      await deleteDoc(doc(db, 'users', user.uid));
                                      setSuccess('User profile deleted');
                                      loadUsers();
                                      setTimeout(() => setSuccess(''), 3000);
                                    } catch (e) {
                                      console.error(e);
                                      setError('Failed to delete user profile');
                                    }
                                  }}
                                >Delete</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Courses Tab */}
            {activeTab === 'courses' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Course Management</h3>
                  <button
                    onClick={() => setShowCourseForm(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Course</span>
                  </button>
                </div>

                {showCourseForm && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                    <input
                      type="text"
                      placeholder="Course Name (e.g., Computer Science, Electronics)"
                      value={courseData.name}
                      onChange={(e) => setCourseData({...courseData, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={addCourse}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                      >
                        Add Course
                      </button>
                      <button
                        onClick={() => setShowCourseForm(false)}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courses.map(course => (
                    <div key={course.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900">{course.name}</h4>
                        <button
                          onClick={() => deleteCourse(course.id)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-500">
                        Semesters: {course.semesters.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Requests Tab */}
            {activeTab === 'requests' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">All Attendance Requests</h3>
                
                {requests.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No attendance requests found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classes</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Faculty</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {requests.map(request => (
                          <tr key={request.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{request.studentName}</div>
                                <div className="text-sm text-gray-500">PRN: {request.prn}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{request.course}</div>
                              <div className="text-sm text-gray-500">Sem {request.semester}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="space-y-1">
                                {(
                                  Array.isArray((request as any).classDetails)
                                    ? (request as any).classDetails
                                    : [(request as any).classDetails]
                                ).map((cd: any, idx: number) => (
                                  <div key={idx}>
                                    <span className="font-medium">{cd.subject}</span>
                                    <span className="text-gray-500"> • {cd.date ? new Date(cd.date).toLocaleDateString() : '-'}{cd.time ? ` - ${cd.time}` : ''}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{request.facultyName}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                request.status === 'approved' ? 'bg-green-100 text-green-800' :
                                request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {request.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {request.submittedAt?.toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
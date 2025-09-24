export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'student' | 'faculty' | 'admin';
  course?: string;
  semester?: string;
  prn?: string;
  facultyId?: string;
}

export interface TimeTableEntry {
  id: string;
  course: string;
  semester: string;
  day: string; // Day of week (0-6)
  date?: string; // Actual date (YYYY-MM-DD)
  time: string;
  subject: string;
  facultyId: string;
  facultyName: string;
}

export interface AttendanceRequest {
  id: string;
  studentId: string;
  studentName: string;
  prn: string;
  course: string;
  semester: string;
  // Destination faculty selected by student
  facultyId: string;
  facultyName: string;
  // Support bundling multiple classes in a single request
  classDetails: Array<{
    subject: string;
    date: string; // ISO date string (YYYY-MM-DD)
    time: string;
    day: string; // 0-6 or name
    timetableEntryId?: string; // optional reference to timetable entry
  }>;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
  processedAt?: Date;
  previousStatus?: 'pending' | 'approved' | 'rejected';
}

export interface Course {
  id: string;
  name: string;
  semesters: string[];
}
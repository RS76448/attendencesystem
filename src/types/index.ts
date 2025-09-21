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
  day: string;
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
  facultyId: string;
  facultyName: string;
  classDetails: {
    subject: string;
    date: string;
    time: string;
    day: string;
  };
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
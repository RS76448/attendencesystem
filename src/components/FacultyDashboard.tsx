import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { AttendanceRequest } from '../types';
import { CheckCircle, XCircle, Clock, Calendar, User, AlertCircle, Undo2 } from 'lucide-react';
import Layout from './Layout';

export default function FacultyDashboard() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser) {
      loadRequests();
    }
  }, [currentUser]);

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
      
      await updateDoc(requestRef, {
        status,
        processedAt: new Date(),
        previousStatus: currentRequest?.status,
      });

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
      
      await updateDoc(requestRef, {
        status: currentRequest?.previousStatus || 'pending',
        processedAt: null,
        previousStatus: null,
      });

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

  const filteredRequests = requests;
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-3xl font-bold text-gray-900">{requests.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-3xl font-bold text-yellow-600">{pendingCount}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-3xl font-bold text-green-600">{approvedCount}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-3xl font-bold text-red-600">{rejectedCount}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
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

          {/* Requests List */}
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
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={() => processRequest(request.id, 'approved')}
                            disabled={processing === request.id}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center space-x-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => processRequest(request.id, 'rejected')}
                            disabled={processing === request.id}
                            className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center space-x-1"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}
                      
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
      </div>
    </Layout>
  );
}